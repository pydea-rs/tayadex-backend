module.exports = {
    apps: [
      {
        name: "tayadex-backend",
        script: "./dist/server.mjs",
        cwd: "./",
        instances: 1,
        exec_mode: "fork",
        watch: true,
        ignore_watch: ["node_modules", "dist", "logs"],
        env: {
          NODE_ENV: "development",
          PORT: 4200
        },
        error_file: "./logs/err.log",
        out_file: "./logs/out.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss"
      }
    ]
  };
  