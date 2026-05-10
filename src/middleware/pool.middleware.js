const Pool = require('../models/pool.model');
const { errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');
const { PoolStatus } = require('../enums/pool.enum');

const isPoolOwner = async (req, res, next) => {
  try {
    const poolId = req.params.poolId;
    const pool = await Pool.findOne({ poolId });
    
    if (!pool) {
      return errorResponse(res, 'Pool not found', null, STATUS_CODES.NOT_FOUND);
    }
    
    if (pool.createdBy.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'Not authorized. You must be the pool host to perform this action.', null, STATUS_CODES.FORBIDDEN);
    }
    
    req.pool = pool; // Attach to request to avoid re-fetching
    next();
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

const isAllowedUser = async (req, res, next) => {
  try {
    const poolId = req.params.poolId;
    const pool = await Pool.findOne({ poolId });
    
    if (!pool) {
      return errorResponse(res, 'Pool not found', null, STATUS_CODES.NOT_FOUND);
    }
    
    if (pool.poolStatus !== PoolStatus.ACTIVE) {
      return errorResponse(res, 'This pool is no longer active', null, STATUS_CODES.FORBIDDEN);
    }

    const isOwner = pool.createdBy.toString() === req.user._id.toString();
    const isAllowed = pool.allowedUsers.includes(req.user._id);
    
    // Only users who are explicitly allowed or the host can access the stream/items
    if (!isOwner && !isAllowed) {
      return errorResponse(res, 'Not authorized to access this pool. You must join the pool first.', null, STATUS_CODES.FORBIDDEN);
    }
    
    req.pool = pool;
    next();
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  isPoolOwner,
  isAllowedUser,
};
