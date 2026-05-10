const userService = require('../services/user.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');

const updateProfile = async (req, res) => {
  try {
    const updatedProfile = await userService.updateProfile(req.user._id, req.body);
    return successResponse(res, 'Profile updated successfully', updatedProfile);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const updateConnectionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const result = await userService.updateConnectionStatus(req.user._id, status);
    return successResponse(res, 'Connection status updated', result);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

module.exports = {
  updateProfile,
  updateConnectionStatus,
};
