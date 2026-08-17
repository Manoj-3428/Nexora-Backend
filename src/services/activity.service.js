const Activity = require('../models/activity.model');
const logger = require('../utils/logger.util');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination.util');

class ActivityService {
  /**
   * Record an activity. Never throws into the caller's happy path — activity
   * logging must not break a pool/file/user operation.
   */
  async log({ type, userId, actorId = null, poolId = null, itemId = null, metadata = {} }) {
    try {
      await Activity.create({ type, userId, actorId, poolId, itemId, metadata });
    } catch (err) {
      logger.error(`Activity log failed (${type}): ${err.message}`);
    }
  }

  async getUserActivity(userId, query = {}) {
    const { page, limit, skip } = parsePagination(query);

    const filter = { userId };
    if (query.type) filter.type = query.type;
    if (query.poolId) filter.poolId = query.poolId;

    const [items, total] = await Promise.all([
      Activity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'userId username name profilePic')
        .populate('poolId', 'poolId poolName')
        .lean(),
      Activity.countDocuments(filter),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }
}

module.exports = new ActivityService();
