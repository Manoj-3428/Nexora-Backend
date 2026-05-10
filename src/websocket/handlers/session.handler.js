const logger = require('../../utils/logger.util');
const EVENTS = require('../../constants/socket.events');
const ActiveSession = require('../../models/activeSession.model');
const Pool = require('../../models/pool.model');
const { v4: uuidv4 } = require('uuid');

const registerSessionHandlers = (io, socket) => {
  socket.on(EVENTS.SESSION.HEARTBEAT, async (data) => {
    const { poolId } = data;
    try {
      const pool = await Pool.findOne({ poolId });
      if (pool) {
        await ActiveSession.findOneAndUpdate(
          { poolId: pool._id, userId: socket.user._id },
          { lastHeartbeat: new Date() }
        );
      }
    } catch (err) {
      logger.error(`Heartbeat update failed: ${err.message}`);
    }
  });

  socket.on(EVENTS.SESSION.SYNC, (data) => {
    const { poolId, itemId, action, currentTime } = data;
    socket.to(`pool_${poolId}`).emit(EVENTS.SESSION.SYNC, { itemId, action, currentTime });
  });

  socket.on(EVENTS.SESSION.RECONNECT, (data) => {
    const { poolId } = data;
    socket.join(`pool_${poolId}`);
    socket.to(`pool_${poolId}`).emit(EVENTS.SESSION.PEER_RECONNECTED, { userId: socket.user.userId, newSocketId: socket.id });
  });

  // WebRTC
  socket.on(EVENTS.WEBRTC.OFFER, (data) => {
    socket.to(data.targetSocketId).emit(EVENTS.WEBRTC.OFFER, { offer: data.offer, senderId: socket.user.userId, senderSocketId: socket.id });
  });

  socket.on(EVENTS.WEBRTC.ANSWER, (data) => {
    socket.to(data.targetSocketId).emit(EVENTS.WEBRTC.ANSWER, { answer: data.answer, senderId: socket.user.userId });
  });

  socket.on(EVENTS.WEBRTC.ICE_CANDIDATE, (data) => {
    socket.to(data.targetSocketId).emit(EVENTS.WEBRTC.ICE_CANDIDATE, { candidate: data.candidate, senderId: socket.user.userId });
  });
};

module.exports = registerSessionHandlers;
