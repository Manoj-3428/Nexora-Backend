const mongoose = require('mongoose');
const { SessionStatus } = require('../enums/session.enum');

const activeSessionSchema = new mongoose.Schema(
  {
    sessionId: {
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
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PoolItem',
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastHeartbeat: {
      type: Date,
      default: Date.now,
    },
    connectionType: {
      type: String, // 'WEBRTC', 'WIFI_DIRECT'
      default: 'WEBRTC',
    },
    playbackPosition: {
      type: Number, // current position in seconds
      default: 0,
    },
    sessionStatus: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.ACTIVE,
    },
    deviceInfo: {
      type: mongoose.Schema.Types.Mixed, // Browser/OS info
      default: {},
    },
    currentBitrate: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes to quickly find active sessions in a pool and clean up stale sessions
activeSessionSchema.index({ poolId: 1, sessionStatus: 1 });
activeSessionSchema.index({ lastHeartbeat: 1 });
activeSessionSchema.index({ poolId: 1, userId: 1 }); // Compound index for ownership/presence validation

module.exports = mongoose.model('ActiveSession', activeSessionSchema);
