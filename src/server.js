const http = require('http');
const app = require('./app');
const envConfig = require('./config/env.config');
const connectDatabase = require('./database/connection');
const logger = require('./utils/logger.util');
const { initializeSocket } = require('./websocket/socket.manager');
const { startCleanupWorker } = require('./workers/cleanup.worker');

const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Start Server & Connect to DB
const startServer = async () => {
  try {
    await connectDatabase();
    
    // Start the background cron jobs for cleanup
    startCleanupWorker();
    
    server.listen(envConfig.PORT, () => {
      logger.info(`Nexora Backend is running on port ${envConfig.PORT} in ${envConfig.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
