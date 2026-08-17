const activityService = require('../services/activity.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');

const fetchActivity = async (req, res) => {
  try {
    const result = await activityService.getUserActivity(req.user._id, req.query);
    return successResponse(res, 'Activity retrieved', result);
  } catch (error) {
    return errorResponse(res, error.message, error, error.statusCode || STATUS_CODES.BAD_REQUEST);
  }
};

module.exports = { fetchActivity };
