const bcrypt = require('bcrypt');
const User = require('../models/user.model');
const { generateToken } = require('../utils/jwt.util');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../utils/response.util');
const { STATUS_CODES, ERROR_CODES } = require('../constants/app.constants');
const {
  normalizeUsername,
  isValidUsername,
  buildBaseUsername,
  generateAvailableUsername,
} = require('../utils/username.util');

class AuthService {
  async isUsernameTaken(username) {
    const existing = await User.exists({ username: normalizeUsername(username) });
    return Boolean(existing);
  }

  /**
   * Register a user.
   * Backward compatible: still accepts `name`. Additionally supports
   * firstName/lastName and an optional desired `username`.
   */
  async registerUser(data) {
    const { email, password, deviceId } = data;

    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new AppError('User already exists', STATUS_CODES.CONFLICT, ERROR_CODES.USERNAME_TAKEN);
    }

    // Derive name / first / last from whatever the client sent.
    let { firstName, lastName, name } = data;
    if ((!firstName || !lastName) && name) {
      const parts = name.trim().split(/\s+/);
      firstName = firstName || parts[0] || '';
      lastName = lastName || parts.slice(1).join(' ') || '';
    }
    if (!name) {
      name = `${firstName || ''} ${lastName || ''}`.trim();
    }

    // Resolve a unique username: honour a valid requested one, else generate.
    let username;
    if (data.username) {
      if (!isValidUsername(data.username)) {
        throw new AppError(
          'Invalid username. Use 3-30 chars: letters, numbers, underscore.',
          STATUS_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      username = normalizeUsername(data.username);
      if (await this.isUsernameTaken(username)) {
        throw new AppError('Username is already taken', STATUS_CODES.CONFLICT, ERROR_CODES.USERNAME_TAKEN);
      }
    } else {
      const base = buildBaseUsername(firstName, lastName);
      username = await generateAvailableUsername(base, (u) => this.isUsernameTaken(u));
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      userId: uuidv4(),
      name,
      firstName: firstName || '',
      lastName: lastName || '',
      username,
      email,
      passwordHash,
      deviceId,
    });

    return {
      userId: user.userId,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
    };
  }

  async loginUser(email, password, deviceId) {
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      if (deviceId && user.deviceId !== deviceId) {
        user.deviceId = deviceId;
        user.tokenVersion += 1; // Invalidate old device tokens
        await user.save();
      }

      const tokenPayload = {
        userId: user._id,
        deviceId: user.deviceId,
        tokenVersion: user.tokenVersion,
      };

      const token = generateToken(tokenPayload);

      return {
        user: {
          userId: user.userId,
          name: user.name,
          username: user.username,
          email: user.email,
          deviceId: user.deviceId,
        },
        token,
      };
    }

    throw new AppError('Invalid email or password', STATUS_CODES.UNAUTHORIZED, ERROR_CODES.NOT_AUTHORIZED);
  }

  async logoutUser(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);

    user.tokenVersion += 1;
    await user.save();
    return true;
  }
}

module.exports = new AuthService();
