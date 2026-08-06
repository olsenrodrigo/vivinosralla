module.exports = {
  apps: [{
    name: "whitelabel-loja",
    script: "./dist/index.cjs",
    env_production: {
      NODE_ENV: "production",
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "512M",
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    time: true,
  }],
};
