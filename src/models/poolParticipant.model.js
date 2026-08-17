const mongoose = require('mongoose');
const { ParticipantRole, ParticipantStatus } = require('../enums/pool.enum');

/**
 * Pool membership record.
 *
 * IMPORTANT: participation is NOT the same as authorization.
 *  - `Pool.allowedUsers`  => users explicitly AUTHORIZED to access a private pool (owner-managed).
 *  - `PoolParticipant`    => users who have actually JOINED the pool (public or private).
 *  - `ActiveSession`      => users currently CONNECTED in real time (heartbeat-based).
 */
const poolParticipantSchema = new mongoose.Schema(
  {
    poolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pool',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(ParticipantRole),
      default: ParticipantRole.MEMBER,
    },
    status: {
      type: String,
      enum: Object.values(ParticipantStatus),
      default: ParticipantStatus.JOINED,
    },
    // How the user gained access, for auditing (PUBLIC | AUTHORIZED | PASSWORD | OWNER).
    joinMethod: {
      type: String,
      default: 'PUBLIC',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One membership document per (pool, user).
poolParticipantSchema.index({ poolId: 1, userId: 1 }, { unique: true });
poolParticipantSchema.index({ poolId: 1, status: 1 });
poolParticipantSchema.index({ userId: 1, status: 1, createdAt: -1 }); // "pools I joined" history

module.exports = mongoose.model('PoolParticipant', poolParticipantSchema);
