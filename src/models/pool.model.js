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
    // Short, user-facing code for QR / manual join. Separate from the internal poolId
    // so that the join identifier is not the same secret as internal references.
    poolCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
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
    // Maximum concurrent participants allowed in the pool.
    maxParticipants: {
      type: Number,
      default: 10,
      min: 1,
    },
    // Count of users who have currently joined (participation), maintained on join/leave.
    currentParticipantCount: {
      type: Number,
      default: 0,
    },
    activeUsersCount: {
      type: Number,
      default: 0,
    },
    // Whether the pool should surface in discovery queries.
    discoveryEnabled: {
      type: Boolean,
      default: true,
    },
    // Discovery location as a GeoJSON Point [longitude, latitude].
    // Used ONLY for proximity discovery; exact coordinates are never returned to non-owners.
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: undefined,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },
    endedAt: {
      type: Date,
      default: null,
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
poolSchema.index({ createdBy: 1, createdAt: -1 }); // Owner history listing
// Geospatial index for 5km / nearby discovery ($geoNear).
poolSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Pool', poolSchema);
