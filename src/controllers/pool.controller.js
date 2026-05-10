const poolService = require('../services/pool.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');

const createPool = async (req, res) => {
  try {
    const pool = await poolService.createPool(req.user, req.body);
    return successResponse(res, 'Pool created successfully', pool, STATUS_CODES.CREATED);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const fetchNearbyPools = async (req, res) => {
  try {
    const pools = await poolService.getNearbyPools();
    return successResponse(res, 'Nearby pools retrieved', pools);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

const getPoolDetails = async (req, res) => {
  try {
    const pool = await poolService.getPoolDetails(req.params.poolId);
    return successResponse(res, 'Pool details retrieved', pool);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.NOT_FOUND);
  }
};

const updatePool = async (req, res) => {
  try {
    const pool = await poolService.updatePool(req.user, req.params.poolId, req.body);
    return successResponse(res, 'Pool updated successfully', pool);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const deletePool = async (req, res) => {
  try {
    await poolService.deletePool(req.user, req.params.poolId);
    return successResponse(res, 'Pool deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const closePool = async (req, res) => {
  try {
    const pool = await poolService.closePool(req.user, req.params.poolId);
    return successResponse(res, 'Pool closed successfully', pool);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const joinPool = async (req, res) => {
  try {
    const pool = await poolService.joinPool(req.user._id, req.params.poolId);
    return successResponse(res, 'Joined pool successfully', pool);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const leavePool = async (req, res) => {
  try {
    const pool = await poolService.leavePool(req.user._id, req.params.poolId);
    return successResponse(res, 'Left pool successfully', pool);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const verifyPassword = async (req, res) => {
  try {
    await poolService.verifyPoolPassword(req.params.poolId, req.body.password);
    return successResponse(res, 'Password verified successfully');
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.UNAUTHORIZED);
  }
};

module.exports = {
  createPool,
  fetchNearbyPools,
  getPoolDetails,
  updatePool,
  deletePool,
  closePool,
  joinPool,
  leavePool,
  verifyPassword,
};
