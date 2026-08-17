const mongoose = require('mongoose');

const ACTIVITY_TYPES = [
  'POOL_CREATED',
  'POOL_JOINED',
  'POOL_LEFT',
  'USER_ADDED',
  'USER_REMOVED',
  'FILE_ADDED',
  'FILE_REMOVED',
  'POOL_ENDED',
  'POOL_EXPIRED',
];

/**
 * Lightweight activity feed. One row per meaningful pool event.
 * Kept intentionally small (no high-frequency events such as heartbeats or seeks).
 */
const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
    },
    // The user this activity belongs to / is surfaced for (usually the pool owner and/or actor).
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Who performed the action (may differ from userId).
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    poolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pool',
      default: null,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PoolItem',
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
