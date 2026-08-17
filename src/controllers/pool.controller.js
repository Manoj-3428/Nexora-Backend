const poolService = require('../services/pool.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');

const fail = (res, error, fallback) => errorResponse(res, error.message, error, error.statusCode || fallback);

const createPool = async (req, res) => {
  try {
    const pool = await poolService.createPool(req.user, req.body);
    return successResponse(res, 'Pool created successfully', pool, STATUS_CODES.CREATED);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

// Geospatial discovery within ~5km (and non-GPS fallback listing).
const discoverPools = async (req, res) => {
  try {
    const pools = await poolService.discoverPools(req.query);
    return successResponse(res, 'Pools discovered', pools);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const fetchNearbyPools = async (req, res) => {
  try {
    const pools = await poolService.getNearbyPools(req.query);
    return successResponse(res, 'Nearby pools retrieved', pools);
  } catch (error) {
    return fail(res, error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

const getPoolByCode = async (req, res) => {
  try {
    const pool = await poolService.findPoolByCode(req.params.code, req.user);
    return successResponse(res, 'Pool retrieved', pool);
  } catch (error) {
    return fail(res, error, STATUS_CODES.NOT_FOUND);
  }
};

const getPoolHistory = async (req, res) => {
  try {
    const result = await poolService.getPoolHistory(req.user, req.query);
    return successResponse(res, 'Pool history retrieved', result);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const getPoolHistoryDetail = async (req, res) => {
  try {
    const pool = await poolService.getPoolHistoryDetail(req.user, req.params.poolId);
    return successResponse(res, 'Pool history detail retrieved', pool);
  } catch (error) {
    return fail(res, error, STATUS_CODES.NOT_FOUND);
  }
};

const getPoolDetails = async (req, res) => {
  try {
    const pool = await poolService.getPoolDetails(req.params.poolId, req.user);
    return successResponse(res, 'Pool details retrieved', pool);
  } catch (error) {
    return fail(res, error, STATUS_CODES.NOT_FOUND);
  }
};

const updatePool = async (req, res) => {
  try {
    const pool = await poolService.updatePool(req.user, req.params.poolId, req.body);
    return successResponse(res, 'Pool updated successfully', pool);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const deletePool = async (req, res) => {
  try {
    await poolService.deletePool(req.user, req.params.poolId);
    return successResponse(res, 'Pool deleted successfully');
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const closePool = async (req, res) => {
  try {
    const pool = await poolService.closePool(req.user, req.params.poolId);
    return successResponse(res, 'Pool closed successfully', pool);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const endPool = async (req, res) => {
  try {
    const pool = await poolService.endPool(req.user, req.params.poolId);
    return successResponse(res, 'Pool ended successfully', pool);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const joinPool = async (req, res) => {
  try {
    const pool = await poolService.joinPool(req.user, req.params.poolId, req.body);
    return successResponse(res, 'Joined pool successfully', pool);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const leavePool = async (req, res) => {
  try {
    const result = await poolService.leavePool(req.user, req.params.poolId);
    return successResponse(res, 'Left pool successfully', result);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const verifyPassword = async (req, res) => {
  try {
    await poolService.verifyPoolPassword(req.params.poolId, req.body.password);
    return successResponse(res, 'Password verified successfully');
  } catch (error) {
    return fail(res, error, STATUS_CODES.UNAUTHORIZED);
  }
};

/* -------------------------- authorized users -------------------------- */

const addAuthorizedUser = async (req, res) => {
  try {
    const identifier = req.body.userId || req.body.username;
    const user = await poolService.addAuthorizedUser(req.user, req.params.poolId, identifier);
    return successResponse(res, 'User authorized', user, STATUS_CODES.CREATED);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const removeAuthorizedUser = async (req, res) => {
  try {
    await poolService.removeAuthorizedUser(req.user, req.params.poolId, req.params.userId);
    return successResponse(res, 'User authorization revoked');
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const listAuthorizedUsers = async (req, res) => {
  try {
    const users = await poolService.listAuthorizedUsers(req.user, req.params.poolId);
    return successResponse(res, 'Authorized users retrieved', users);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

/* ----------------------------- participants ---------------------------- */

const listParticipants = async (req, res) => {
  try {
    const result = await poolService.listParticipants(req.user, req.params.poolId, req.query);
    return successResponse(res, 'Participants retrieved', result);
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

const removeParticipant = async (req, res) => {
  try {
    await poolService.removeParticipant(req.user, req.params.poolId, req.params.userId);
    return successResponse(res, 'Participant removed');
  } catch (error) {
    return fail(res, error, STATUS_CODES.BAD_REQUEST);
  }
};

module.exports = {
  createPool,
  discoverPools,
  fetchNearbyPools,
  getPoolByCode,
  getPoolHistory,
  getPoolHistoryDetail,
  getPoolDetails,
  updatePool,
  deletePool,
  closePool,
  endPool,
  joinPool,
  leavePool,
  verifyPassword,
  addAuthorizedUser,
  removeAuthorizedUser,
  listAuthorizedUsers,
  listParticipants,
  removeParticipant,
};
