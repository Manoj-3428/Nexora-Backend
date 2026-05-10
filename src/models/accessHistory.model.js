const mongoose = require('mongoose');

const accessHistorySchema = new mongoose.Schema(
  {
    historyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    poolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pool',
      required: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PoolItem',
      default: null,
    },
    accessedAt: {
      type: Date,
      default: Date.now,
    },
    durationWatched: {
      type: Number, // In seconds
      default: 0,
    },
    connectionType: {
      type: String,
      default: 'WEBRTC',
    },
    sessionDuration: {
      type: Number, // Total time connected to pool in this session
      default: 0,
    },
  },
  {
    timestamps: true, // We don't really update this, mostly insert-only
  }
);

// Index for user analytics
accessHistorySchema.index({ userId: 1, accessedAt: -1 });

module.exports = mongoose.model('AccessHistory', accessHistorySchema);
