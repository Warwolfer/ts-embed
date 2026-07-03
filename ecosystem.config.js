module.exports = {
  apps: [
    {
      name: "ts-embed",
      script: "server.js",
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: "production", PORT: 8080 },
    },
  ],
};
