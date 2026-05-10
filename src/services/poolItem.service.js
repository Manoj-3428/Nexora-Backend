const PoolItem = require('../models/poolItem.model');
const Pool = require('../models/pool.model');
const { v4: uuidv4 } = require('uuid');

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
    return poolItem;
  }

  async removePoolItem(user, poolId, itemId) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new Error('Pool not found');

    const item = await PoolItem.findOne({ itemId, poolId: pool._id, ownerId: user._id });
    if (!item) throw new Error('Item not found or unauthorized');
    await PoolItem.deleteOne({ _id: item._id });
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
