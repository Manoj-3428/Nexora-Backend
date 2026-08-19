const logger = require('../../utils/logger.util');
const EVENTS = require('../../constants/socket.events');

const registerPoolHandlers = (io, socket) => {
  socket.on(EVENTS.POOL.USER_JOINED, async (data) => {
    const { poolId } = data;
    const room = `pool_${poolId}`;

    try {
      // Snapshot peers already in the room BEFORE we join, so the newcomer can
      // initiate WebRTC offers to each of them. `socket.data.user` is set in the
      // auth middleware and is readable on RemoteSockets via fetchSockets().
      const existing = await io.in(room).fetchSockets();
      const peers = existing.map((s) => ({
        socketId: s.id,
        userId: s.data?.user?.userId,
        name: s.data?.user?.name,
      }));

      socket.join(room);
      logger.info(`User ${socket.user.name} joined pool room ${poolId}`);

      // Give the newcomer the current peer roster (direct, only to this socket).
      socket.emit(EVENTS.POOL.PEERS, { poolId, peers });

      // Tell existing peers about the newcomer, including its socketId for signaling.
      socket.to(room).emit(EVENTS.POOL.USER_JOINED, {
        poolId,
        userId: socket.user.userId,
        name: socket.user.name,
        socketId: socket.id,
      });
    } catch (err) {
      logger.error(`pool:user_joined roster failed: ${err.message}`);
    }
  });

  socket.on(EVENTS.POOL.USER_LEFT, (data) => {
    const { poolId } = data;
    socket.leave(`pool_${poolId}`);
    logger.info(`User ${socket.user.name} left pool room ${poolId}`);
    socket.to(`pool_${poolId}`).emit(EVENTS.POOL.USER_LEFT, {
      poolId,
      userId: socket.user.userId,
      socketId: socket.id,
    });
  });

  socket.on(EVENTS.ACCESS.REVOKED, (data) => {
    const { poolId, targetUserId } = data;
    io.to(`pool_${poolId}`).emit(EVENTS.ACCESS.REVOKED, { targetUserId });
  });
};

module.exports = registerPoolHandlers;
