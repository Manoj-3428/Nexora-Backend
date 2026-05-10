const cron = require('node-cron');
const Pool = require('../models/pool.model');
const ActiveSession = require('../models/activeSession.model');
const logger = require('../utils/logger.util');
const { PoolStatus } = require('../enums/pool.enum');
const { getIo } = require('../websocket/socket.manager');
const EVENTS = require('../constants/socket.events');

const startCleanupWorker = () => {
  // Run every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      logger.info('Starting periodic cleanup worker...');
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - 60 * 1000); // 60 seconds ago
      const io = getIo();

      // 1. Clean up stale sessions
      const staleSessions = await ActiveSession.find({
        lastHeartbeat: { $lt: staleThreshold },
      });

      if (staleSessions.length > 0) {
        const sessionIds = staleSessions.map((s) => s._id);
        
        // Notify others in the pool that these users disconnected
        staleSessions.forEach((session) => {
          logger.info(`Cleaning up stale session for User ${session.userId} in Pool ${session.poolId}`);
          io.to(`pool_${session.poolId}`).emit(EVENTS.POOL.USER_LEFT, {
            userId: session.userId,
            reason: 'timeout',
          });
        });

        // Delete the stale sessions
        await ActiveSession.deleteMany({ _id: { $in: sessionIds } });
      }

      // 2. Mark pools as EXPIRED if their expiresAt has passed
      const expiredPools = await Pool.find({
        poolStatus: PoolStatus.ACTIVE,
        expiresAt: { $lt: now },
      });

      if (expiredPools.length > 0) {
        const poolIds = expiredPools.map((p) => p._id);
        
        // Update DB
        await Pool.updateMany(
          { _id: { $in: poolIds } },
          { $set: { poolStatus: PoolStatus.EXPIRED } }
        );

        // Notify clients and clean up their sessions
        for (const pool of expiredPools) {
          logger.info(`Pool ${pool.poolId} has expired. Emitting closure events.`);
          io.to(`pool_${pool.poolId}`).emit(EVENTS.POOL.CLOSED, {
            poolId: pool.poolId,
            reason: 'expired',
          });

          // Delete all sessions for the expired pool
          await ActiveSession.deleteMany({ poolId: pool._id });
        }
      }
    } catch (error) {
      logger.error(`Error in cleanup worker: ${error.message}`);
    }
  });
};

module.exports = { startCleanupWorker };
