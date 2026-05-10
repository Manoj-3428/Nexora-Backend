const logger = require('../../utils/logger.util');
const EVENTS = require('../../constants/socket.events');

const registerPoolHandlers = (io, socket) => {
  socket.on(EVENTS.POOL.USER_JOINED, (data) => {
    const { poolId } = data;
    socket.join(`pool_${poolId}`);
    logger.info(`User ${socket.user.name} joined pool room ${poolId}`);
    socket.to(`pool_${poolId}`).emit(EVENTS.POOL.USER_JOINED, { userId: socket.user.userId, name: socket.user.name });
  });

  socket.on(EVENTS.POOL.USER_LEFT, (data) => {
    const { poolId } = data;
    socket.leave(`pool_${poolId}`);
    logger.info(`User ${socket.user.name} left pool room ${poolId}`);
    socket.to(`pool_${poolId}`).emit(EVENTS.POOL.USER_LEFT, { userId: socket.user.userId });
  });

  socket.on(EVENTS.ACCESS.REVOKED, (data) => {
    const { poolId, targetUserId } = data;
    io.to(`pool_${poolId}`).emit(EVENTS.ACCESS.REVOKED, { targetUserId });
  });
};

module.exports = registerPoolHandlers;
