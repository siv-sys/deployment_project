// ============================================================================
// PM2 Configuration for Siv Backend
// Server IP: 172.16.16.69
// Target Location: /var/www/siv/backend/pm2-backend.config.js
// ============================================================================

module.exports = {
  apps: [
    {
      name: 'siv-backend',
      script: './server.js',
      cwd: '/var/www/siv/backend',
      instances: 'max', // Run in cluster mode utilizing all CPU cores
      exec_mode: 'cluster',
      autorestart: true, // Auto restart if backend crashes
      watch: false, // Set to true only in dev environment
      max_memory_restart: '1G', // Restart if leaks make it exceed 1GB memory
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
