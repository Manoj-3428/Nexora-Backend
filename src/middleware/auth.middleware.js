const { verifyToken } = require('../utils/jwt.util');
const { errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');
const User = require('../models/user.model');
const logger = require('../utils/logger.util');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = verifyToken(token);

      const user = await User.findById(decoded.userId).select('-passwordHash');

      if (!user) {
        return errorResponse(res, 'Not authorized, user not found', null, STATUS_CODES.UNAUTHORIZED);
      }

      // Check token version to invalidate old tokens
      if (user.tokenVersion !== decoded.tokenVersion) {
        return errorResponse(res, 'Not authorized, token expired', null, STATUS_CODES.UNAUTHORIZED);
      }

      // Check device ID binding
      if (decoded.deviceId && user.deviceId !== decoded.deviceId) {
         return errorResponse(res, 'Not authorized, device mismatch', null, STATUS_CODES.UNAUTHORIZED);
      }

      req.user = user;
      req.deviceId = decoded.deviceId;
      next();
    } catch (error) {
      logger.error(`Auth Error: ${error.message}`);
      return errorResponse(res, 'Not authorized, token failed', null, STATUS_CODES.UNAUTHORIZED);
    }
  }

  if (!token) {
    return errorResponse(res, 'Not authorized, no token', null, STATUS_CODES.UNAUTHORIZED);
  }
};

module.exports = { protect };
