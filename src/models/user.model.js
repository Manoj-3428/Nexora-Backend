const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    profilePic: {
      type: String,
      default: '',
    },
    deviceId: {
      type: String,
      required: true,
    },
    publicKey: {
      type: String,
      default: '',
    },
    connectionStatus: {
      type: String,
      default: 'OFFLINE',
    },
    activePoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pool',
      default: null,
    },
    profileVisibility: {
      type: String,
      enum: ['PUBLIC', 'PRIVATE', 'CONTACTS_ONLY'],
      default: 'PUBLIC',
    },
    appVersion: {
      type: String,
      default: '1.0.0',
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
