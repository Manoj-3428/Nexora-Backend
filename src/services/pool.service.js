const Pool = require('../models/pool.model');
const { PoolStatus } = require('../enums/pool.enum');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

class PoolService {
  async createPool(user, poolData) {
    let passwordHash = null;
    if (poolData.passwordProtected && poolData.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(poolData.password, salt);
    }

    const pool = await Pool.create({
      poolId: uuidv4(),
      poolName: poolData.poolName,
      createdBy: user._id,
      expiresAt: poolData.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000), // Default 2 hours
      isPublic: poolData.isPublic !== undefined ? poolData.isPublic : true,
      passwordProtected: poolData.passwordProtected || false,
      passwordHash,
      hostDeviceId: user.deviceId,
      localIp: poolData.localIp,
      port: poolData.port,
      protocolType: poolData.protocolType,
    });

    // Update user's active pool
    user.activePoolId = pool._id;
    await user.save();

    return pool;
  }

  async getNearbyPools() {
    // Only return active, public pools that haven't expired
    return await Pool.find({
      poolStatus: PoolStatus.ACTIVE,
      isPublic: true,
      expiresAt: { $gt: new Date() },
    })
      .select('-passwordHash')
      .populate('createdBy', 'name userId');
  }

  async getPoolDetails(poolId) {
    const pool = await Pool.findOne({ poolId }).select('-passwordHash').populate('createdBy', 'name userId profilePic');
    if (!pool) throw new Error('Pool not found');
    return pool;
  }

  async updatePool(user, poolId, updateData) {
    const pool = await Pool.findOne({ poolId, createdBy: user._id });
    if (!pool) throw new Error('Pool not found or unauthorized');

    if (updateData.poolName) pool.poolName = updateData.poolName;
    if (updateData.isPublic !== undefined) pool.isPublic = updateData.isPublic;
    if (updateData.passwordProtected !== undefined) {
      pool.passwordProtected = updateData.passwordProtected;
      if (updateData.password) {
        const salt = await bcrypt.genSalt(10);
        pool.passwordHash = await bcrypt.hash(updateData.password, salt);
      }
    }
    
    await pool.save();
    return pool;
  }

  async deletePool(user, poolId) {
    const pool = await Pool.findOne({ poolId, createdBy: user._id });
    if (!pool) throw new Error('Pool not found or unauthorized');
    await Pool.deleteOne({ _id: pool._id });
    return true;
  }

  async closePool(user, poolId) {
    const pool = await Pool.findOne({ poolId, createdBy: user._id });
    if (!pool) throw new Error('Pool not found or unauthorized');
    pool.poolStatus = PoolStatus.CLOSED;
    await pool.save();
    return pool;
  }

  async joinPool(userId, poolId) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new Error('Pool not found');
    if (pool.poolStatus !== PoolStatus.ACTIVE) throw new Error('Pool is not active');

    if (!pool.allowedUsers.includes(userId)) {
      pool.allowedUsers.push(userId);
      pool.activeUsersCount += 1;
      pool.totalAccessCount += 1;
      await pool.save();
    }
    return pool;
  }

  async leavePool(userId, poolId) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new Error('Pool not found');
    
    pool.allowedUsers = pool.allowedUsers.filter(id => id.toString() !== userId.toString());
    pool.activeUsersCount = Math.max(0, pool.activeUsersCount - 1);
    await pool.save();
    return pool;
  }

  async verifyPoolPassword(poolId, password) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new Error('Pool not found');
    if (!pool.passwordProtected) return true;
    
    const isValid = await bcrypt.compare(password, pool.passwordHash);
    if (!isValid) throw new Error('Invalid pool password');
    return true;
  }
}

module.exports = new PoolService();
