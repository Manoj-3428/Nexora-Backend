const AccessHistory = require('../models/accessHistory.model');
const Pool = require('../models/pool.model');
const PoolItem = require('../models/poolItem.model');

class HistoryService {
  async fetchUserHistory(userId, limit = 50) {
    return await AccessHistory.find({ userId })
      .sort({ accessedAt: -1 })
      .limit(limit)
      .populate('poolId', 'poolName poolId')
      .populate('itemId', 'itemName itemType');
  }

  async fetchPoolAnalytics(poolIdString) {
    const pool = await Pool.findOne({ poolId: poolIdString });
    if (!pool) throw new Error('Pool not found');

    const stats = await AccessHistory.aggregate([
      { $match: { poolId: pool._id } },
      {
        $group: {
          _id: '$itemId',
          totalViews: { $sum: 1 },
          totalDurationWatched: { $sum: '$durationWatched' },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          itemId: '$_id',
          totalViews: 1,
          totalDurationWatched: 1,
          uniqueUserCount: { $size: '$uniqueUsers' },
        },
      },
    ]);
    return stats;
  }

  async fetchItemAnalytics(itemIdString) {
    const item = await PoolItem.findOne({ itemId: itemIdString });
    if (!item) throw new Error('Item not found');

    const stats = await AccessHistory.aggregate([
      { $match: { itemId: item._id } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: 1 },
          averageDuration: { $avg: '$durationWatched' },
          totalDuration: { $sum: '$durationWatched' },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
    ]);
    return stats.length ? stats[0] : null;
  }
}

module.exports = new HistoryService();
