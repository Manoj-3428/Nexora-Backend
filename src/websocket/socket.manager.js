const socketIo = require('socket.io');
const logger = require('../utils/logger.util');
const { verifyToken } = require('../utils/jwt.util');
const User = require('../models/user.model');
const registerPoolHandlers = require('./handlers/pool.handler');
const registerSessionHandlers = require('./handlers/session.handler');

let io;

const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Socket.io Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const tokenHeader = socket.handshake.auth.token || socket.handshake.headers['authorization'];
      if (!tokenHeader) {
        return next(new Error('Authentication error: Token missing'));
      }

      const token = tokenHeader.replace('Bearer ', '');
      const decoded = verifyToken(token);

      const user = await User.findById(decoded.userId).select('userId name deviceId tokenVersion');
      if (!user) return next(new Error('Authentication error: User not found'));

      if (user.tokenVersion !== decoded.tokenVersion) {
        return next(new Error('Authentication error: Token expired'));
      }

      socket.user = {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        deviceId: user.deviceId,
      };
      
      next();
    } catch (err) {
      logger.error(`Socket Auth Error: ${err.message}`);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`New Socket Connection: ${socket.id} (User: ${socket.user.name})`);

    // Allow user to join a personal room based on their userId to receive direct messages
    socket.join(`user_${socket.user.userId}`);

    // Register modular handlers
    registerPoolHandlers(io, socket);
    registerSessionHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info(`Socket Disconnected: ${socket.id} (User: ${socket.user.name})`);
      // Cron workers handle ActiveSession cleanup, but we can emit a presence event here if needed
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIo,
};
