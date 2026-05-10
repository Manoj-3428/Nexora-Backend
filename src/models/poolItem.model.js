const mongoose = require('mongoose');

const poolItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    poolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pool',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    itemName: {
      type: String,
      required: true,
    },
    itemType: {
      type: String, // e.g., 'VIDEO', 'AUDIO', 'DOCUMENT', 'IMAGE'
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number, // Applicable for video/audio
      default: null,
    },
    thumbnail: {
      type: String,
      default: '',
    },
    localPath: {
      type: String, // Used if stored on the host device directly
      default: '',
    },
    checksumHash: {
      type: String,
      default: '',
    },
    streamUrl: {
      type: String,
      default: '',
      // ARCHITECTURE NOTE (Phase 1 P2P):
      // Do NOT treat this as a centralized CDN/media-hosting URL.
      // This field represents local endpoint metadata, temporary peer-access
      // information, or a local-network access reference for direct device-to-device streaming.
    },
    streamable: {
      type: Boolean,
      default: false,
      // Indicates if the sender's device can currently serve this file directly
      // over the local network / P2P connection.
    },
  },
  {
    timestamps: true,
  }
);

// Indexes to fetch items for a specific pool quickly
poolItemSchema.index({ poolId: 1, itemType: 1 });

module.exports = mongoose.model('PoolItem', poolItemSchema);
