const logger = require('./logger.util');

/**
 * Thin, crash-safe wrapper around Socket.IO so services can emit realtime
 * events without a hard dependency on socket initialization order.
 * Requiring socket.manager lazily avoids a circular require at module load.
 */
const safeGetIo = () => {
  try {
    // Lazy require to dodge circular dependency (socket.manager -> handlers -> models).
    // eslint-disable-next-line global-require
    const { getIo } = require('../websocket/socket.manager');
    return getIo();
  } catch (err) {
    return null;
  }
};

const poolRoom = (poolId) => `pool_${poolId}`;
const userRoom = (userId) => `user_${userId}`;

/** Emit an event to everyone currently in a pool room. */
const emitToPool = (poolId, event, payload) => {
  const io = safeGetIo();
  if (!io) return;
  try {
    io.to(poolRoom(poolId)).emit(event, payload);
  } catch (err) {
    logger.error(`emitToPool failed (${event}): ${err.message}`);
  }
};

/** Emit an event to a specific user's personal room (public userId). */
const emitToUser = (userId, event, payload) => {
  const io = safeGetIo();
  if (!io) return;
  try {
    io.to(userRoom(userId)).emit(event, payload);
  } catch (err) {
    logger.error(`emitToUser failed (${event}): ${err.message}`);
  }
};

module.exports = {
  emitToPool,
  emitToUser,
};
