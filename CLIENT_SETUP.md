# Client setup

This source export includes the latest local `17-mar-2026` checkout at commit
`42a98851a2bef37d92ec1daafcfd3236fb690fb9`, with the sanitization changes below.
It contains no Git history, existing environment file, user database, dependencies,
logs, or compiled output.

## Local setup

Install Bun, then run these commands from this directory:

```sh
bun install --frozen-lockfile
cp .env.example .env
openssl rand -hex 32
```

Paste the generated value into `BETTER_AUTH_SECRET` in `.env`. Choose your own
`ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters). Keep the two base URLs
set to `http://localhost:3000` for local development.

```sh
bun run db:migrate
bun run db:seed-admin
bun run dev
```

Open `http://localhost:3000/dashboard` and sign in with the credentials you chose.
The seeder creates a new admin or grants the admin role to an existing account;
it does not reset an existing account's password. Remove `ADMIN_PASSWORD` from
`.env` after seeding and store it in your password manager.

## Integrations

Use your own Discord bot token, client ID, guild ID, and comma-separated monitored
channel IDs. Enable the message content intent in both the Discord developer
portal and `.env` if message content ingestion is required. Leave the token and
IDs blank to run locally without connecting to Discord. The dashboard initially
has no community data.

Set your own `ANTHROPIC_API_KEY` to enable live AI sentiment classification and
AI chat. The app can start without it. Never put credentials in variables prefixed
with `BUN_PUBLIC_`; those variables can be embedded in browser bundles.

## Build and production configuration

```sh
bun run build
bun run start
```

Before deploying, set `APP_BASE_URL` and `BETTER_AUTH_BASE_URL` to your HTTPS origin,
keep a private random `BETTER_AUTH_SECRET`, and replace the example hostnames in
`nginx.conf`. Supply your own deployment target through `SERVER_HOST`,
`SERVER_USER`, and `REMOTE_DIR`. Review `scripts/deploy.sh` before running it: it
uses `rsync --delete`, applies migrations, and reloads the PM2 service. No deployment
has been performed as part of this export.

## Sanitization changes

- Exported tracked source only, without Git metadata or local runtime files.
- Removed the default admin credentials and password logging; seeding requires
  explicitly supplied credentials.
- Removed hard-coded production server addresses and authentication origin;
  deployment configuration uses explicit inputs or example hostnames.
- Removed the embedded Discord invite from the legacy event page.
- Added a blank environment template covering authentication, seeding, and
  integrations, and expanded ignore rules for private configuration and backups.

Product branding, public support contact addresses, source code, migration
definitions, and synthetic test fixtures remain included.
