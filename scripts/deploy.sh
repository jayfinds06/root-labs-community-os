#!/usr/bin/env bash

set -euo pipefail

SERVER_HOST="${SERVER_HOST:?Set SERVER_HOST to your deployment hostname}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/rl-discord}"
APP_NAME="${APP_NAME:-rltt}"
REMOTE_BUN_BIN="${REMOTE_BUN_BIN:-}"
REMOTE_NODE_BIN="${REMOTE_NODE_BIN:-}"
INSTALL_DEPS="${INSTALL_DEPS:-auto}"
REMOTE_DEPS_HASH_FILE="${REMOTE_DEPS_HASH_FILE:-.deploy-deps-hash}"
REMOTE_DB_PATH="${REMOTE_DB_PATH:-data/app.db}"
REMOTE_DB_SNAPSHOT_DIR="${REMOTE_DB_SNAPSHOT_DIR:-data/snapshots}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

echo "Ensuring remote deploy directory exists..."
ssh -p "${SERVER_PORT}" "${SERVER_USER}@${SERVER_HOST}" "mkdir -p '${REMOTE_DIR}'"

echo "Syncing repository to ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}..."
rsync -az --delete \
  -e "ssh -p ${SERVER_PORT}" \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "data" \
  --exclude "dist" \
  --exclude ".env" \
  --exclude ".env.*" \
  "${REPO_ROOT}/" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"

echo "Deploying on remote host..."
ssh -p "${SERVER_PORT}" "${SERVER_USER}@${SERVER_HOST}" "bash -lc '
set -euo pipefail

set +u
[ -f \"\$HOME/.profile\" ] && source \"\$HOME/.profile\"
[ -f \"\$HOME/.bash_profile\" ] && source \"\$HOME/.bash_profile\"
[ -f \"\$HOME/.bashrc\" ] && source \"\$HOME/.bashrc\"
[ -f \"\$HOME/.zprofile\" ] && source \"\$HOME/.zprofile\"
[ -f \"\$HOME/.zshrc\" ] && source \"\$HOME/.zshrc\"
[ -s \"\$HOME/.nvm/nvm.sh\" ] && source \"\$HOME/.nvm/nvm.sh\"
set -u

export PATH=\"${REMOTE_BUN_BIN:-\$HOME/.bun/bin}:\$PATH\"
if [ -n \"${REMOTE_NODE_BIN}\" ]; then
  export PATH=\"\$(dirname \"${REMOTE_NODE_BIN}\"):\$PATH\"
fi

resolved_node_bin=\"\"
if command -v node >/dev/null 2>&1; then
  resolved_node_bin=\"\$(command -v node)\"
elif command -v nodejs >/dev/null 2>&1; then
  resolved_node_bin=\"\$(command -v nodejs)\"
else
  for candidate in \
    \"\$HOME/.nvm/versions/node\"/*/bin/node \
    \"\$HOME/.nvm/versions/node\"/*/bin/nodejs \
    \"\$HOME/n/bin/node\" \
    \"/usr/local/bin/node\" \
    \"/usr/local/bin/nodejs\" \
    \"/usr/bin/node\" \
    \"/usr/bin/nodejs\" \
    \"/bin/node\" \
    \"/bin/nodejs\" \
    \"/snap/bin/node\" \
    \"/opt/homebrew/bin/node\" \
    \"/opt/node/bin/node\"
  do
    if [ -x \"\$candidate\" ]; then
      resolved_node_bin=\"\$candidate\"
      break
    fi
  done
fi

if [ -n \"\$resolved_node_bin\" ]; then
  shim_dir=\$(mktemp -d)
  cat >\"\$shim_dir/node\" <<\"EOF\"
#!/usr/bin/env bash
exec \"__NODE_BIN__\" \"\$@\"
EOF
  sed -i \"s|__NODE_BIN__|\$resolved_node_bin|g\" \"\$shim_dir/node\"
  chmod +x \"\$shim_dir/node\"
  export PATH=\"\$shim_dir:\$PATH\"
fi

cd "${REMOTE_DIR}"
if ! command -v bun >/dev/null 2>&1; then
  echo \"bun not found on remote PATH: \$PATH\" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo \"node not found on remote PATH: \$PATH\" >&2
  echo \"Checked REMOTE_NODE_BIN, nvm, and common absolute paths.\" >&2
  echo \"Set REMOTE_NODE_BIN to the remote node binary if it is installed outside shell init.\" >&2
  exit 1
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo \"pm2 not found on remote PATH: \$PATH\" >&2
  exit 1
fi

command -v bun
command -v node
command -v pm2

if [ -f \"${REMOTE_DB_PATH}\" ]; then
  snapshot_ts=\"\$(date +%Y%m%d-%H%M%S)\"
  db_filename=\"\$(basename \"${REMOTE_DB_PATH}\")\"
  db_snapshot_path=\"${REMOTE_DB_SNAPSHOT_DIR}/\${db_filename}.\${snapshot_ts}.backup\"

  echo \"Creating DB snapshot at \${db_snapshot_path}...\"
  mkdir -p \"${REMOTE_DB_SNAPSHOT_DIR}\"
  cp -p \"${REMOTE_DB_PATH}\" \"\${db_snapshot_path}\"
  echo \"DB backup created: \${db_snapshot_path}\"
else
  echo \"Skipping DB snapshot; ${REMOTE_DB_PATH} does not exist on remote.\"
fi

deps_hash_input=\"\"
[ -f package.json ] && deps_hash_input=\"\$(cat package.json)\"
[ -f bun.lock ] && deps_hash_input=\"\${deps_hash_input}\$(cat bun.lock)\"
current_deps_hash=\"\$(printf \"%s\" \"\$deps_hash_input\" | sha256sum | awk \"{print \\\$1}\")\"
previous_deps_hash=\"\"
[ -f \"${REMOTE_DEPS_HASH_FILE}\" ] && previous_deps_hash=\"\$(cat \"${REMOTE_DEPS_HASH_FILE}\")\"

should_install_deps=\"0\"
if [ \"${INSTALL_DEPS}\" = \"1\" ] || [ \"${INSTALL_DEPS}\" = \"true\" ]; then
  should_install_deps=\"1\"
elif [ ! -d node_modules ] || [ \"\$current_deps_hash\" != \"\$previous_deps_hash\" ]; then
  should_install_deps=\"1\"
fi

if [ \"\$should_install_deps\" = \"1\" ]; then
  echo \"Installing project dependencies...\"
  bun install
  if [ -f node_modules/bun/install.js ]; then
    (cd node_modules/bun && node install.js)
  fi
  printf \"%s\" \"\$current_deps_hash\" > \"${REMOTE_DEPS_HASH_FILE}\"
else
  echo \"Skipping bun install; reusing existing node_modules\"
fi

bun run build
bun run db:migrate
pm2 startOrReload ecosystem.config.cjs --only "${APP_NAME}"
pm2 save
'"

echo "Deployment complete."
