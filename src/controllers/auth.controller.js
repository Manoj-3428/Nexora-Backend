const authService = require('../services/auth.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');

const registerUser = async (req, res) => {
  try {
    const user = await authService.registerUser(req.body);
    return successResponse(res, 'User registered successfully', user, STATUS_CODES.CREATED);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;
    const data = await authService.loginUser(email, password, deviceId);
    return successResponse(res, 'Login successful', data);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.UNAUTHORIZED);
  }
};

const logoutUser = async (req, res) => {
  try {
    await authService.logoutUser(req.user._id);
    return successResponse(res, 'Logout successful');
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const getProfile = async (req, res) => {
  try {
    const user = req.user;
    return successResponse(res, 'Profile retrieved', {
      userId: user.userId,
      name: user.name,
      email: user.email,
      deviceId: user.deviceId,
    });
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getProfile,
};
