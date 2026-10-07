module.exports = {
  apps: [
    {
      name: "rltt",
      script: "bun",
      interpreter: "none",
      args: "run start",
      env: {
        NODE_ENV: "production",
      },
      watch: false,
      max_memory_restart: "1G",
      autorestart: true,
      restart_delay: 1000,
    },
  ],
};
