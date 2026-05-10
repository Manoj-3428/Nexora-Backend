const bcrypt = require('bcrypt');
const User = require('../models/user.model');
const { generateToken } = require('../utils/jwt.util');
const { v4: uuidv4 } = require('uuid');

class AuthService {
  async registerUser(data) {
    const { name, email, password, deviceId } = data;

    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = uuidv4();

    const user = await User.create({
      userId,
      name,
      email,
      passwordHash,
      deviceId,
    });

    return {
      userId: user.userId,
      name: user.name,
      email: user.email,
    };
  }

  async loginUser(email, password, deviceId) {
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      // If user logs in from a new device, we might want to update it or handle it.
      // For now, update the deviceId if provided and different.
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
          email: user.email,
          deviceId: user.deviceId,
        },
        token,
      };
    } else {
      throw new Error('Invalid email or password');
    }
  }

  async logoutUser(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Increment tokenVersion to invalidate existing JWTs
    user.tokenVersion += 1;
    await user.save();
    return true;
  }
}

module.exports = new AuthService();
