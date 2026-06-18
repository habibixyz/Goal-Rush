// PM2 ecosystem config — run: npx pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'goalrush-keeper',
      script: 'scripts/keeper.cjs',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file: 'logs/keeper-out.log',
      error_file: 'logs/keeper-err.log',
      merge_logs: true
    }
  ]
};
