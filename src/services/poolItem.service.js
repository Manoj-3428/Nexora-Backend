const PoolItem = require('../models/poolItem.model');
const Pool = require('../models/pool.model');
const { v4: uuidv4 } = require('uuid');
const { emitToPool } = require('../utils/realtime.util');
const EVENTS = require('../constants/socket.events');
const activityService = require('./activity.service');
const { AppError } = require('../utils/response.util');
const { STATUS_CODES, ERROR_CODES } = require('../constants/app.constants');

class PoolItemService {
  async addPoolItem(user, poolId, itemData) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new Error('Pool not found');

    const poolItem = await PoolItem.create({
      itemId: uuidv4(),
      poolId: pool._id,
      ownerId: user._id,
      itemName: itemData.itemName,
      itemType: itemData.itemType,
      mimeType: itemData.mimeType,
      size: itemData.size,
      duration: itemData.duration,
      thumbnail: itemData.thumbnail,
      localPath: itemData.localPath,
      checksumHash: itemData.checksumHash,
      streamUrl: itemData.streamUrl,
      streamable: itemData.streamable || false,
    });

    // Increment pool stats
    pool.totalFiles += 1;
    pool.totalSize += itemData.size;
    await pool.save();

    emitToPool(pool.poolId, EVENTS.FILE.ADDED, {
      poolId: pool.poolId,
      itemId: poolItem.itemId,
      itemName: poolItem.itemName,
      itemType: poolItem.itemType,
      size: poolItem.size,
    });
    activityService.log({ type: 'FILE_ADDED', userId: pool.createdBy, actorId: user._id, poolId: pool._id, itemId: poolItem._id, metadata: { itemName: poolItem.itemName } });

    return poolItem;
  }

  async removePoolItem(user, poolId, itemId) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new Error('Pool not found');

    // Owner of the pool (enforced by route middleware) or the item's uploader may remove it.
    const isPoolOwner = pool.createdBy.toString() === user._id.toString();
    const query = isPoolOwner ? { itemId, poolId: pool._id } : { itemId, poolId: pool._id, ownerId: user._id };
    const item = await PoolItem.findOne(query);
    if (!item) throw new AppError('Item not found or unauthorized', STATUS_CODES.NOT_FOUND, ERROR_CODES.FILE_NOT_FOUND);

    // Decrement pool stats
    pool.totalFiles = Math.max(0, pool.totalFiles - 1);
    pool.totalSize = Math.max(0, pool.totalSize - item.size);
    await pool.save();

    await PoolItem.deleteOne({ _id: item._id });

    emitToPool(pool.poolId, EVENTS.FILE.REMOVED, { poolId: pool.poolId, itemId: item.itemId });
    activityService.log({ type: 'FILE_REMOVED', userId: pool.createdBy, actorId: user._id, poolId: pool._id, metadata: { itemName: item.itemName } });

    return true;
  }

  async updateItemMetadata(user, poolId, itemId, updateData) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new Error('Pool not found');

    const item = await PoolItem.findOne({ itemId, poolId: pool._id, ownerId: user._id });
    if (!item) throw new Error('Item not found or unauthorized');
    
    if (updateData.itemName) item.itemName = updateData.itemName;
    if (updateData.thumbnail) item.thumbnail = updateData.thumbnail;
    if (updateData.streamUrl !== undefined) item.streamUrl = updateData.streamUrl;
    
    await item.save();
    return item;
  }

  async fetchPoolItems(poolId, query = {}) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new Error('Pool not found');

    const filters = { poolId: pool._id };
    if (query.itemType) filters.itemType = query.itemType;
    return await PoolItem.find(filters).populate('ownerId', 'name userId profilePic');
  }

  async fetchItemDetails(poolId, itemId) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new Error('Pool not found');

    const item = await PoolItem.findOne({ poolId: pool._id, itemId }).populate('ownerId', 'name userId profilePic');
    if (!item) throw new Error('Item not found');
    return item;
  }
}

module.exports = new PoolItemService();
