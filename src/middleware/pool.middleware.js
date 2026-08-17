const Pool = require('../models/pool.model');
const PoolParticipant = require('../models/poolParticipant.model');
const { errorResponse } = require('../utils/response.util');
const { STATUS_CODES, ERROR_CODES } = require('../constants/app.constants');
const { PoolStatus, ParticipantStatus } = require('../enums/pool.enum');

const isPoolOwner = async (req, res, next) => {
  try {
    const poolId = req.params.poolId;
    const pool = await Pool.findOne({ poolId });
    
    if (!pool) {
      return errorResponse(res, 'Pool not found', null, STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);
    }

    if (pool.createdBy.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'Not authorized. You must be the pool host to perform this action.', null, STATUS_CODES.FORBIDDEN, ERROR_CODES.NOT_AUTHORIZED);
    }

    req.pool = pool; // Attach to request to avoid re-fetching
    next();
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Grants access to pool content (items/streaming) when the requester is:
 *  - the owner, OR
 *  - an active participant (has joined), OR
 *  - an explicitly authorized user, OR
 *  - any authenticated user for a PUBLIC pool.
 * The pool must be ACTIVE and not expired.
 */
const isAllowedUser = async (req, res, next) => {
  try {
    const poolId = req.params.poolId;
    const pool = await Pool.findOne({ poolId });

    if (!pool) {
      return errorResponse(res, 'Pool not found', null, STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);
    }

    const expired = pool.poolStatus === PoolStatus.EXPIRED || (pool.expiresAt && pool.expiresAt <= new Date());
    if (expired) {
      return errorResponse(res, 'This pool has expired', null, STATUS_CODES.FORBIDDEN, ERROR_CODES.POOL_EXPIRED);
    }
    if (pool.poolStatus !== PoolStatus.ACTIVE) {
      return errorResponse(res, 'This pool is no longer active', null, STATUS_CODES.FORBIDDEN, ERROR_CODES.POOL_ENDED);
    }

    const isOwner = pool.createdBy.toString() === req.user._id.toString();
    const isAuthorized = pool.allowedUsers.some((id) => id.toString() === req.user._id.toString());

    let hasAccess = isOwner || isAuthorized || pool.isPublic;
    if (!hasAccess) {
      hasAccess = Boolean(
        await PoolParticipant.exists({ poolId: pool._id, userId: req.user._id, status: ParticipantStatus.JOINED })
      );
    }

    if (!hasAccess) {
      return errorResponse(res, 'Not authorized to access this pool. You must join the pool first.', null, STATUS_CODES.FORBIDDEN, ERROR_CODES.ACCESS_DENIED);
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
