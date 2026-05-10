const mongoose = require('mongoose');
const { PoolProtocol, PoolStatus } = require('../enums/pool.enum');

const poolSchema = new mongoose.Schema(
  {
    poolId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    poolName: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    passwordProtected: {
      type: Boolean,
      default: false,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    allowedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    hostDeviceId: {
      type: String,
      required: true,
    },
    localIp: {
      type: String,
      default: null,
    },
    port: {
      type: Number,
      default: null,
    },
    protocolType: {
      type: String,
      enum: Object.values(PoolProtocol),
      default: PoolProtocol.WEBRTC,
    },
    poolStatus: {
      type: String,
      enum: Object.values(PoolStatus),
      default: PoolStatus.ACTIVE,
    },
    activeUsersCount: {
      type: Number,
      default: 0,
    },
    totalAccessCount: {
      type: Number,
      default: 0,
    },
    thumbnail: {
      type: String,
      default: '',
    },
    totalFiles: {
      type: Number,
      default: 0,
    },
    totalSize: {
      type: Number,
      default: 0,
    },
    categories: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for nearby pool discovery
poolSchema.index({ poolStatus: 1, isPublic: 1, expiresAt: 1 });
poolSchema.index({ poolStatus: 1, expiresAt: 1 }); // Index for cleanup worker scanning

module.exports = mongoose.model('Pool', poolSchema);
