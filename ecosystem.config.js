module.exports = {
  apps: [{
    name: 'jobtracker-expert',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/jobtracker-error.log',
    out_file: '/var/log/pm2/jobtracker-out.log',
    log_file: '/var/log/pm2/jobtracker.log'
  }]
};