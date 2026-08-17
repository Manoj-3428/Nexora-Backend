const User = require('../models/user.model');
const { AppError } = require('../utils/response.util');
const { STATUS_CODES, ERROR_CODES } = require('../constants/app.constants');
const { normalizeUsername, isValidUsername } = require('../utils/username.util');
const { parsePagination } = require('../utils/pagination.util');

// Fields safe to expose about OTHER users (search / lookups).
const PUBLIC_USER_FIELDS = 'userId username name firstName lastName profilePic';

// Shape the authenticated user's own profile.
const toSelfProfile = (user) => ({
  userId: user.userId,
  username: user.username,
  name: user.name,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  profilePic: user.profilePic,
  profileVisibility: user.profileVisibility,
  connectionStatus: user.connectionStatus,
  deviceId: user.deviceId,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

class UserService {
  async getMe(userId) {
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) throw new AppError('User not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);
    return toSelfProfile(user);
  }

  /**
   * Check whether a username is available (and valid).
   */
  async checkUsernameAvailability(rawUsername) {
    const username = normalizeUsername(rawUsername);
    if (!isValidUsername(username)) {
      return { username, valid: false, available: false, reason: 'INVALID_FORMAT' };
    }
    const taken = await User.exists({ username });
    return { username, valid: true, available: !taken };
  }

  /**
   * Search users by username (prefix-optimized) for adding to private pools.
   * Never exposes email or sensitive fields.
   */
  async searchUsers(rawQuery, requesterId, query = {}) {
    const term = normalizeUsername(rawQuery);
    if (!term || term.length < 2) {
      throw new AppError('Search term must be at least 2 characters', STATUS_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const { limit } = parsePagination({ limit: query.limit });

    // Anchored regex leverages the username index for prefix matches.
    const users = await User.find({
      username: { $regex: `^${term}`, $options: 'i' },
      _id: { $ne: requesterId },
    })
      .select(PUBLIC_USER_FIELDS)
      .limit(limit)
      .lean();

    return users;
  }

  async updateProfile(userId, profileData) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);

    if (profileData.name) user.name = profileData.name;
    if (profileData.firstName !== undefined) user.firstName = profileData.firstName;
    if (profileData.lastName !== undefined) user.lastName = profileData.lastName;
    if (profileData.profilePic !== undefined) user.profilePic = profileData.profilePic;
    if (profileData.profileVisibility) user.profileVisibility = profileData.profileVisibility;
    if (profileData.publicKey !== undefined) user.publicKey = profileData.publicKey;

    // Username change with uniqueness enforcement.
    if (profileData.username && normalizeUsername(profileData.username) !== user.username) {
      const username = normalizeUsername(profileData.username);
      if (!isValidUsername(username)) {
        throw new AppError(
          'Invalid username. Use 3-30 chars: letters, numbers, underscore.',
          STATUS_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      const taken = await User.exists({ username, _id: { $ne: userId } });
      if (taken) throw new AppError('Username is already taken', STATUS_CODES.CONFLICT, ERROR_CODES.USERNAME_TAKEN);
      user.username = username;
    }

    await user.save();
    return toSelfProfile(user);
  }

  async updateConnectionStatus(userId, status) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);

    user.connectionStatus = status;
    user.lastSeen = Date.now();
    await user.save();
    return { connectionStatus: user.connectionStatus, lastSeen: user.lastSeen };
  }
}

module.exports = new UserService();
module.exports.PUBLIC_USER_FIELDS = PUBLIC_USER_FIELDS;
