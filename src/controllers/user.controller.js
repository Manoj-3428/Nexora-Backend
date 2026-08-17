const userService = require('../services/user.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');

const getMe = async (req, res) => {
  try {
    const profile = await userService.getMe(req.user._id);
    return successResponse(res, 'Current user retrieved', profile);
  } catch (error) {
    return errorResponse(res, error.message, error, error.statusCode || STATUS_CODES.BAD_REQUEST);
  }
};

const checkUsername = async (req, res) => {
  try {
    const result = await userService.checkUsernameAvailability(req.query.username);
    return successResponse(res, 'Username availability checked', result);
  } catch (error) {
    return errorResponse(res, error.message, error, error.statusCode || STATUS_CODES.BAD_REQUEST);
  }
};

const searchUsers = async (req, res) => {
  try {
    const users = await userService.searchUsers(req.query.username || req.query.q, req.user._id, req.query);
    return successResponse(res, 'Users retrieved', users);
  } catch (error) {
    return errorResponse(res, error.message, error, error.statusCode || STATUS_CODES.BAD_REQUEST);
  }
};

const updateProfile = async (req, res) => {
  try {
    const updatedProfile = await userService.updateProfile(req.user._id, req.body);
    return successResponse(res, 'Profile updated successfully', updatedProfile);
  } catch (error) {
    return errorResponse(res, error.message, error, error.statusCode || STATUS_CODES.BAD_REQUEST);
  }
};

const updateConnectionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const result = await userService.updateConnectionStatus(req.user._id, status);
    return successResponse(res, 'Connection status updated', result);
  } catch (error) {
    return errorResponse(res, error.message, error, error.statusCode || STATUS_CODES.BAD_REQUEST);
  }
};

module.exports = {
  getMe,
  checkUsername,
  searchUsers,
  updateProfile,
  updateConnectionStatus,
};
