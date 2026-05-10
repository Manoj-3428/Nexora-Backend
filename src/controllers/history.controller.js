const historyService = require('../services/history.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');

const fetchUserHistory = async (req, res) => {
  try {
    const history = await historyService.fetchUserHistory(req.user._id, req.query.limit);
    return successResponse(res, 'User history retrieved', history);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

const fetchPoolAnalytics = async (req, res) => {
  try {
    const analytics = await historyService.fetchPoolAnalytics(req.params.poolId);
    return successResponse(res, 'Pool analytics retrieved', analytics);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

const fetchItemAnalytics = async (req, res) => {
  try {
    const analytics = await historyService.fetchItemAnalytics(req.params.itemId);
    return successResponse(res, 'Item analytics retrieved', analytics);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  fetchUserHistory,
  fetchPoolAnalytics,
  fetchItemAnalytics,
};
