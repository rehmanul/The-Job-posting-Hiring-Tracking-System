module.exports = {
  apps: [{
    name: 'job-tracker',
    script: 'dist/index.js',
    env: {
      NODE_ENV: 'production'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 50,
    restart_delay: 4000,
    kill_timeout: 5000,
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    cron_restart: '0 2 * * *'
  }]
};