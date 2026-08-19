const socketIo = require('socket.io');
const logger = require('../utils/logger.util');
const { verifyToken } = require('../utils/jwt.util');
const User = require('../models/user.model');
const registerPoolHandlers = require('./handlers/pool.handler');
const registerSessionHandlers = require('./handlers/session.handler');
const EVENTS = require('../constants/socket.events');

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
      // Mirror onto socket.data so it is readable on RemoteSockets returned by
      // io.in(room).fetchSockets() (used to build the WebRTC peer roster).
      socket.data.user = { userId: user.userId, name: user.name };

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

    // On disconnect, tell every pool room this socket was in so peers can tear
    // down their WebRTC connection immediately (don't wait for the heartbeat
    // cleanup worker). `disconnecting` still has the room set populated.
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('pool_')) {
          const poolId = room.slice('pool_'.length);
          socket.to(room).emit(EVENTS.POOL.USER_LEFT, {
            poolId,
            userId: socket.user.userId,
            socketId: socket.id,
            reason: 'disconnected',
          });
        }
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket Disconnected: ${socket.id} (User: ${socket.user.name})`);
      // Cron workers handle ActiveSession cleanup.
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
