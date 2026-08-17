const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const Pool = require('../models/pool.model');
const PoolParticipant = require('../models/poolParticipant.model');
const ActiveSession = require('../models/activeSession.model');
const User = require('../models/user.model');

const { PoolStatus, PoolType, ParticipantRole, ParticipantStatus } = require('../enums/pool.enum');
const { AppError } = require('../utils/response.util');
const { STATUS_CODES, ERROR_CODES, POOL_LIMITS } = require('../constants/app.constants');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination.util');
const { isValidCoordinates } = require('../utils/geo.util');
const { generateUniquePoolCode } = require('../utils/poolCode.util');
const { emitToPool, emitToUser } = require('../utils/realtime.util');
const activityService = require('./activity.service');
const EVENTS = require('../constants/socket.events');
const { PUBLIC_USER_FIELDS } = require('./user.service');

const ENDED_STATUSES = [PoolStatus.ENDED, PoolStatus.CLOSED];

/* --------------------------------- helpers -------------------------------- */

const isExpired = (pool) => pool.poolStatus === PoolStatus.EXPIRED || (pool.expiresAt && pool.expiresAt <= new Date());
const isEnded = (pool) => ENDED_STATUSES.includes(pool.poolStatus);

const derivePoolType = (pool) => (pool.isPublic ? PoolType.PUBLIC : PoolType.PRIVATE);

/**
 * Serialize a pool according to the requesting user's relationship to it.
 * relationship: 'owner' | 'member' | 'other'
 * NEVER returns passwordHash. Exact location + transport details are owner-only.
 */
const serializePool = (pool, relationship = 'other') => {
  const base = {
    poolId: pool.poolId,
    poolCode: pool.poolCode,
    poolName: pool.poolName,
    type: derivePoolType(pool),
    isPublic: pool.isPublic,
    passwordProtected: pool.passwordProtected,
    poolStatus: pool.poolStatus,
    maxParticipants: pool.maxParticipants,
    currentParticipantCount: pool.currentParticipantCount,
    activeUsersCount: pool.activeUsersCount,
    totalFiles: pool.totalFiles,
    totalSize: pool.totalSize,
    thumbnail: pool.thumbnail,
    categories: pool.categories,
    protocolType: pool.protocolType,
    discoveryEnabled: pool.discoveryEnabled,
    expiresAt: pool.expiresAt,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    endedAt: pool.endedAt,
    createdBy: pool.createdBy,
  };

  if (relationship === 'other') {
    // For unauthorized viewers of a private pool, hint what's required to join.
    if (!pool.isPublic) {
      base.requiresPassword = pool.passwordProtected;
    }
    return base;
  }

  // Owner & members can see transport/coordination details needed to connect.
  base.hostDeviceId = pool.hostDeviceId;
  base.localIp = pool.localIp;
  base.port = pool.port;

  if (relationship === 'owner') {
    base.allowedUsers = pool.allowedUsers;
    if (pool.location && Array.isArray(pool.location.coordinates)) {
      base.location = {
        longitude: pool.location.coordinates[0],
        latitude: pool.location.coordinates[1],
      };
    }
  }

  return base;
};

const buildLocation = (poolData) => {
  const lat = poolData.latitude ?? poolData.lat ?? poolData?.location?.latitude;
  const lng = poolData.longitude ?? poolData.lng ?? poolData?.location?.longitude;
  if (lat === undefined || lng === undefined) return undefined;
  if (!isValidCoordinates(Number(lat), Number(lng))) {
    throw new AppError('Invalid location coordinates', STATUS_CODES.BAD_REQUEST, ERROR_CODES.INVALID_LOCATION);
  }
  return { type: 'Point', coordinates: [Number(lng), Number(lat)] };
};

const clampParticipants = (value) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return POOL_LIMITS.DEFAULT_PARTICIPANTS;
  return Math.min(POOL_LIMITS.MAX_PARTICIPANTS, Math.max(POOL_LIMITS.MIN_PARTICIPANTS, n));
};

const resolveExpiry = (poolData) => {
  let expiresAt;
  if (poolData.expiresAt) {
    expiresAt = new Date(poolData.expiresAt);
  } else if (poolData.durationMs) {
    expiresAt = new Date(Date.now() + Number(poolData.durationMs));
  } else {
    expiresAt = new Date(Date.now() + POOL_LIMITS.DEFAULT_LIFETIME_MS);
  }

  const lifetime = expiresAt.getTime() - Date.now();
  if (Number.isNaN(lifetime) || lifetime < POOL_LIMITS.MIN_LIFETIME_MS) {
    throw new AppError('Pool lifetime is too short (min 5 minutes)', STATUS_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  if (lifetime > POOL_LIMITS.MAX_LIFETIME_MS) {
    throw new AppError('Pool lifetime is too long (max 24 hours)', STATUS_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return expiresAt;
};

const recountParticipants = async (poolObjectId) => {
  const count = await PoolParticipant.countDocuments({ poolId: poolObjectId, status: ParticipantStatus.JOINED });
  return count;
};

/* --------------------------------- service -------------------------------- */

class PoolService {
  async createPool(user, poolData) {
    let passwordHash = null;
    if (poolData.passwordProtected && poolData.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(poolData.password, salt);
    } else if (poolData.passwordProtected && !poolData.password) {
      throw new AppError('Password is required for a password-protected pool', STATUS_CODES.BAD_REQUEST, ERROR_CODES.PASSWORD_REQUIRED);
    }

    const location = buildLocation(poolData);
    const expiresAt = resolveExpiry(poolData);
    const poolCode = await generateUniquePoolCode((code) => Pool.exists({ poolCode: code }));

    const pool = await Pool.create({
      poolId: uuidv4(),
      poolCode,
      poolName: poolData.poolName,
      createdBy: user._id,
      expiresAt,
      isPublic: poolData.isPublic !== undefined ? poolData.isPublic : true,
      passwordProtected: poolData.passwordProtected || false,
      passwordHash,
      maxParticipants: clampParticipants(poolData.maxParticipants),
      currentParticipantCount: 1, // owner participates
      discoveryEnabled: poolData.discoveryEnabled !== undefined ? poolData.discoveryEnabled : true,
      location,
      hostDeviceId: poolData.hostDeviceId || user.deviceId,
      localIp: poolData.localIp,
      port: poolData.port,
      protocolType: poolData.protocolType,
      categories: poolData.categories || [],
    });

    // Owner is a participant from creation.
    await PoolParticipant.create({
      poolId: pool._id,
      userId: user._id,
      role: ParticipantRole.OWNER,
      status: ParticipantStatus.JOINED,
      joinMethod: 'OWNER',
    });

    user.activePoolId = pool._id;
    await user.save();

    activityService.log({ type: 'POOL_CREATED', userId: user._id, actorId: user._id, poolId: pool._id, metadata: { poolName: pool.poolName } });

    await pool.populate('createdBy', PUBLIC_USER_FIELDS);
    return serializePool(pool, 'owner');
  }

  /**
   * Geospatial discovery within a radius (default/max ~5km).
   * Returns only active, discovery-enabled pools. Exact coordinates are never
   * returned — only an approximate distance + proximity label.
   */
  async discoverPools(queryParams = {}) {
    const { latitude, longitude } = queryParams;
    const lat = latitude !== undefined ? Number(latitude) : undefined;
    const lng = longitude !== undefined ? Number(longitude) : undefined;

    let radius = queryParams.radius !== undefined ? Number(queryParams.radius) : POOL_LIMITS.DEFAULT_DISCOVERY_RADIUS_M;
    if (Number.isNaN(radius) || radius <= 0) radius = POOL_LIMITS.DEFAULT_DISCOVERY_RADIUS_M;
    radius = Math.min(radius, POOL_LIMITS.MAX_DISCOVERY_RADIUS_M);

    const activeMatch = {
      poolStatus: PoolStatus.ACTIVE,
      discoveryEnabled: true,
      expiresAt: { $gt: new Date() },
    };

    // No coordinates => fall back to a non-geo active listing (nearby without GPS).
    if (lat === undefined || lng === undefined) {
      const pools = await Pool.find(activeMatch)
        .sort({ createdAt: -1 })
        .limit(50)
        .select('-passwordHash -location -localIp -port -allowedUsers')
        .populate('createdBy', 'userId username name profilePic')
        .lean();
      return pools.map((p) => ({ ...serializePool(p, 'other'), distanceMeters: null, distance: null, proximity: 'Unknown' }));
    }

    if (!isValidCoordinates(lat, lng)) {
      throw new AppError('Invalid latitude/longitude', STATUS_CODES.BAD_REQUEST, ERROR_CODES.INVALID_LOCATION);
    }

    const { proximityLabel, formatDistance } = require('../utils/geo.util');

    // $geoNear uses the 2dsphere index — efficient, no full-collection distance scan.
    const results = await Pool.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: radius,
          spherical: true,
          query: activeMatch,
        },
      },
      { $limit: 50 },
      {
        $project: {
          passwordHash: 0,
          allowedUsers: 0,
          localIp: 0,
          port: 0,
          hostDeviceId: 0,
          'location.coordinates': 0, // never leak exact pool coordinates
        },
      },
    ]);

    const ownerIds = results.map((p) => p.createdBy);
    const owners = await User.find({ _id: { $in: ownerIds } }).select('userId username name profilePic').lean();
    const ownerMap = new Map(owners.map((o) => [o._id.toString(), o]));

    return results.map((p) => {
      const meters = Math.round(p.distanceMeters);
      return {
        ...serializePool({ ...p, createdBy: ownerMap.get(p.createdBy?.toString()) }, 'other'),
        distanceMeters: meters,
        distance: formatDistance(meters),
        proximity: proximityLabel(meters),
      };
    });
  }

  /** Backward-compatible nearby listing (no GPS filtering). */
  async getNearbyPools(queryParams = {}) {
    return this.discoverPools(queryParams);
  }

  /**
   * Role-aware pool details.
   */
  async getPoolDetails(poolId, user) {
    const pool = await Pool.findOne({ poolId })
      .select('-passwordHash')
      .populate('createdBy', PUBLIC_USER_FIELDS)
      .populate('allowedUsers', PUBLIC_USER_FIELDS);

    if (!pool) throw new AppError('Pool not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    const isOwner = pool.createdBy && pool.createdBy._id.toString() === user._id.toString();
    let relationship = 'other';

    if (isOwner) {
      relationship = 'owner';
    } else {
      const participant = await PoolParticipant.findOne({
        poolId: pool._id,
        userId: user._id,
        status: ParticipantStatus.JOINED,
      });
      const isAuthorized = pool.allowedUsers.some((u) => u._id.toString() === user._id.toString());
      if (participant || isAuthorized || pool.isPublic) relationship = 'member';
    }

    return serializePool(pool, relationship);
  }

  async findPoolByCode(poolCode, user) {
    const pool = await Pool.findOne({ poolCode: String(poolCode).toUpperCase() }).select('poolId');
    if (!pool) throw new AppError('Pool not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);
    return this.getPoolDetails(pool.poolId, user);
  }

  async updatePool(user, poolId, updateData) {
    const pool = await Pool.findOne({ poolId, createdBy: user._id });
    if (!pool) throw new AppError('Pool not found or unauthorized', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    if (updateData.poolName) pool.poolName = updateData.poolName;
    if (updateData.isPublic !== undefined) pool.isPublic = updateData.isPublic;
    if (updateData.discoveryEnabled !== undefined) pool.discoveryEnabled = updateData.discoveryEnabled;
    if (updateData.categories !== undefined) pool.categories = updateData.categories;

    if (updateData.maxParticipants !== undefined) {
      const next = clampParticipants(updateData.maxParticipants);
      if (next < pool.currentParticipantCount) {
        throw new AppError('maxParticipants cannot be below the current participant count', STATUS_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
      }
      pool.maxParticipants = next;
    }

    if (updateData.expiresAt || updateData.durationMs) {
      pool.expiresAt = resolveExpiry(updateData);
    }

    if (updateData.passwordProtected !== undefined) {
      pool.passwordProtected = updateData.passwordProtected;
      if (updateData.passwordProtected) {
        if (!updateData.password && !pool.passwordHash) {
          throw new AppError('Password required to enable protection', STATUS_CODES.BAD_REQUEST, ERROR_CODES.PASSWORD_REQUIRED);
        }
        if (updateData.password) {
          const salt = await bcrypt.genSalt(10);
          pool.passwordHash = await bcrypt.hash(updateData.password, salt);
        }
      } else {
        pool.passwordHash = null;
      }
    } else if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      pool.passwordHash = await bcrypt.hash(updateData.password, salt);
    }

    await pool.save();
    await pool.populate('createdBy', PUBLIC_USER_FIELDS);

    emitToPool(pool.poolId, EVENTS.POOL.UPDATED, { poolId: pool.poolId });
    return serializePool(pool, 'owner');
  }

  async deletePool(user, poolId) {
    const pool = await Pool.findOne({ poolId, createdBy: user._id });
    if (!pool) throw new AppError('Pool not found or unauthorized', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    emitToPool(pool.poolId, EVENTS.POOL.DELETED, { poolId: pool.poolId });

    await Promise.all([
      PoolParticipant.deleteMany({ poolId: pool._id }),
      ActiveSession.deleteMany({ poolId: pool._id }),
      Pool.deleteOne({ _id: pool._id }),
    ]);
    return true;
  }

  /**
   * End a pool. Idempotent — ending an already-ended/expired pool succeeds.
   */
  async endPool(user, poolId) {
    const pool = await Pool.findOne({ poolId, createdBy: user._id });
    if (!pool) throw new AppError('Pool not found or unauthorized', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    if (isEnded(pool)) {
      await pool.populate('createdBy', PUBLIC_USER_FIELDS);
      return serializePool(pool, 'owner'); // idempotent
    }

    pool.poolStatus = PoolStatus.ENDED;
    pool.endedAt = new Date();
    await pool.save();

    // Revoke live sessions and notify connected clients.
    await ActiveSession.deleteMany({ poolId: pool._id });
    emitToPool(pool.poolId, EVENTS.POOL.ENDED, { poolId: pool.poolId, reason: 'ended_by_owner' });
    // Retain legacy event for existing clients.
    emitToPool(pool.poolId, EVENTS.POOL.CLOSED, { poolId: pool.poolId, reason: 'ended' });

    activityService.log({ type: 'POOL_ENDED', userId: user._id, actorId: user._id, poolId: pool._id });

    await pool.populate('createdBy', PUBLIC_USER_FIELDS);
    return serializePool(pool, 'owner');
  }

  // Backward-compatible alias for the existing /close route.
  async closePool(user, poolId) {
    return this.endPool(user, poolId);
  }

  /**
   * Join a pool with full lifecycle + access-control validation.
   */
  async joinPool(user, poolId, body = {}) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new AppError('Pool not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    if (isEnded(pool)) throw new AppError('This pool has ended', STATUS_CODES.FORBIDDEN, ERROR_CODES.POOL_ENDED);
    if (isExpired(pool)) throw new AppError('This pool has expired', STATUS_CODES.FORBIDDEN, ERROR_CODES.POOL_EXPIRED);
    if (pool.poolStatus !== PoolStatus.ACTIVE) throw new AppError('Pool is not active', STATUS_CODES.FORBIDDEN, ERROR_CODES.ACCESS_DENIED);

    const isOwner = pool.createdBy.toString() === user._id.toString();

    // Already an active participant?
    const existing = await PoolParticipant.findOne({ poolId: pool._id, userId: user._id });
    if (existing && existing.status === ParticipantStatus.JOINED) {
      if (isOwner) {
        await pool.populate('createdBy', PUBLIC_USER_FIELDS);
        return serializePool(pool, 'owner');
      }
      throw new AppError('You have already joined this pool', STATUS_CODES.CONFLICT, ERROR_CODES.ALREADY_JOINED);
    }

    // Resolve access + joinMethod.
    let joinMethod = 'PUBLIC';
    const isAuthorized = pool.allowedUsers.some((id) => id.toString() === user._id.toString());

    if (isOwner) {
      joinMethod = 'OWNER';
    } else if (pool.isPublic) {
      joinMethod = 'PUBLIC';
    } else if (isAuthorized) {
      joinMethod = 'AUTHORIZED';
    } else if (pool.passwordProtected) {
      if (!body.password) {
        throw new AppError('Password required to join this pool', STATUS_CODES.UNAUTHORIZED, ERROR_CODES.PASSWORD_REQUIRED);
      }
      const ok = await bcrypt.compare(body.password, pool.passwordHash || '');
      if (!ok) throw new AppError('Invalid pool password', STATUS_CODES.UNAUTHORIZED, ERROR_CODES.INVALID_PASSWORD);
      joinMethod = 'PASSWORD';
    } else {
      throw new AppError('You are not authorized to join this private pool', STATUS_CODES.FORBIDDEN, ERROR_CODES.ACCESS_DENIED);
    }

    // Capacity check (source of truth = JOINED participant count).
    const joinedCount = await recountParticipants(pool._id);
    if (!isOwner && joinedCount >= pool.maxParticipants) {
      throw new AppError('This pool is full', STATUS_CODES.FORBIDDEN, ERROR_CODES.POOL_FULL);
    }

    const role = isOwner ? ParticipantRole.OWNER : ParticipantRole.MEMBER;
    await PoolParticipant.findOneAndUpdate(
      { poolId: pool._id, userId: user._id },
      {
        poolId: pool._id,
        userId: user._id,
        role,
        status: ParticipantStatus.JOINED,
        joinMethod,
        joinedAt: new Date(),
        leftAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    pool.currentParticipantCount = await recountParticipants(pool._id);
    pool.totalAccessCount += 1;
    await pool.save();

    // Realtime + activity (notify pool room and the owner).
    emitToPool(pool.poolId, EVENTS.POOL.USER_JOINED, {
      poolId: pool.poolId,
      userId: user.userId,
      username: user.username,
      name: user.name,
    });
    activityService.log({ type: 'POOL_JOINED', userId: pool.createdBy, actorId: user._id, poolId: pool._id, metadata: { username: user.username } });

    await pool.populate('createdBy', PUBLIC_USER_FIELDS);
    return serializePool(pool, isOwner ? 'owner' : 'member');
  }

  async leavePool(user, poolId) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new AppError('Pool not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    const participant = await PoolParticipant.findOne({ poolId: pool._id, userId: user._id, status: ParticipantStatus.JOINED });
    if (participant) {
      participant.status = ParticipantStatus.LEFT;
      participant.leftAt = new Date();
      await participant.save();
    }

    await ActiveSession.deleteMany({ poolId: pool._id, userId: user._id });

    pool.currentParticipantCount = await recountParticipants(pool._id);
    pool.activeUsersCount = Math.max(0, pool.activeUsersCount - 1);
    await pool.save();

    emitToPool(pool.poolId, EVENTS.POOL.USER_LEFT, { poolId: pool.poolId, userId: user.userId });
    activityService.log({ type: 'POOL_LEFT', userId: pool.createdBy, actorId: user._id, poolId: pool._id });

    return { poolId: pool.poolId, currentParticipantCount: pool.currentParticipantCount };
  }

  async verifyPoolPassword(poolId, password) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new AppError('Pool not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);
    if (!pool.passwordProtected) return true;
    if (!password) throw new AppError('Password required', STATUS_CODES.BAD_REQUEST, ERROR_CODES.PASSWORD_REQUIRED);

    const isValid = await bcrypt.compare(password, pool.passwordHash || '');
    if (!isValid) throw new AppError('Invalid pool password', STATUS_CODES.UNAUTHORIZED, ERROR_CODES.INVALID_PASSWORD);
    return true;
  }

  /* --------------------------- authorized users --------------------------- */

  /** Resolve a user by public userId, username, or Mongo _id. */
  async resolveTargetUser(identifier) {
    if (!identifier) throw new AppError('User identifier required', STATUS_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    const or = [{ userId: identifier }, { username: String(identifier).toLowerCase() }];
    if (mongoose.isValidObjectId(identifier)) or.push({ _id: identifier });
    const target = await User.findOne({ $or: or }).select('_id userId username name profilePic');
    if (!target) throw new AppError('User not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);
    return target;
  }

  async addAuthorizedUser(owner, poolId, identifier) {
    const pool = await Pool.findOne({ poolId, createdBy: owner._id });
    if (!pool) throw new AppError('Pool not found or unauthorized', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    const target = await this.resolveTargetUser(identifier);
    if (target._id.toString() === owner._id.toString()) {
      throw new AppError('Owner already has access', STATUS_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const already = pool.allowedUsers.some((id) => id.toString() === target._id.toString());
    if (!already) {
      pool.allowedUsers.push(target._id);
      await pool.save();
    }

    emitToUser(target.userId, EVENTS.ACCESS.GRANTED, { poolId: pool.poolId, poolName: pool.poolName });
    activityService.log({ type: 'USER_ADDED', userId: owner._id, actorId: owner._id, poolId: pool._id, metadata: { username: target.username } });

    return { userId: target.userId, username: target.username, name: target.name, profilePic: target.profilePic };
  }

  async removeAuthorizedUser(owner, poolId, targetUserId) {
    const pool = await Pool.findOne({ poolId, createdBy: owner._id });
    if (!pool) throw new AppError('Pool not found or unauthorized', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    const target = await this.resolveTargetUser(targetUserId);
    pool.allowedUsers = pool.allowedUsers.filter((id) => id.toString() !== target._id.toString());
    await pool.save();

    // Revoking authorization for a private pool also drops their participation/session.
    if (!pool.isPublic) {
      await PoolParticipant.findOneAndUpdate(
        { poolId: pool._id, userId: target._id, status: ParticipantStatus.JOINED },
        { status: ParticipantStatus.REMOVED, leftAt: new Date() }
      );
      await ActiveSession.deleteMany({ poolId: pool._id, userId: target._id });
      pool.currentParticipantCount = await recountParticipants(pool._id);
      await pool.save();
    }

    emitToUser(target.userId, EVENTS.ACCESS.REVOKED, { poolId: pool.poolId });
    emitToPool(pool.poolId, EVENTS.ACCESS.REVOKED, { poolId: pool.poolId, targetUserId: target.userId });
    activityService.log({ type: 'USER_REMOVED', userId: owner._id, actorId: owner._id, poolId: pool._id, metadata: { username: target.username } });

    return true;
  }

  async listAuthorizedUsers(owner, poolId) {
    const pool = await Pool.findOne({ poolId, createdBy: owner._id }).populate('allowedUsers', PUBLIC_USER_FIELDS);
    if (!pool) throw new AppError('Pool not found or unauthorized', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);
    return pool.allowedUsers;
  }

  /* ------------------------------ participants ---------------------------- */

  async listParticipants(user, poolId, query = {}) {
    const pool = await Pool.findOne({ poolId });
    if (!pool) throw new AppError('Pool not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    const isOwner = pool.createdBy.toString() === user._id.toString();
    const isParticipant = await PoolParticipant.exists({ poolId: pool._id, userId: user._id, status: ParticipantStatus.JOINED });
    if (!isOwner && !isParticipant) {
      throw new AppError('Not authorized to view participants', STATUS_CODES.FORBIDDEN, ERROR_CODES.ACCESS_DENIED);
    }

    const { page, limit, skip } = parsePagination(query);
    const filter = { poolId: pool._id, status: ParticipantStatus.JOINED };

    const [items, total] = await Promise.all([
      PoolParticipant.find(filter)
        .sort({ joinedAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', PUBLIC_USER_FIELDS)
        .lean(),
      PoolParticipant.countDocuments(filter),
    ]);

    const participants = items.map((p) => ({
      user: p.userId,
      role: p.role,
      joinMethod: p.joinMethod,
      joinedAt: p.joinedAt,
    }));

    return buildPaginatedResult(participants, total, page, limit);
  }

  async removeParticipant(owner, poolId, targetUserId) {
    const pool = await Pool.findOne({ poolId, createdBy: owner._id });
    if (!pool) throw new AppError('Pool not found or unauthorized', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    const target = await this.resolveTargetUser(targetUserId);
    if (target._id.toString() === owner._id.toString()) {
      throw new AppError('Owner cannot be removed. End the pool instead.', STATUS_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    await PoolParticipant.findOneAndUpdate(
      { poolId: pool._id, userId: target._id, status: ParticipantStatus.JOINED },
      { status: ParticipantStatus.REMOVED, leftAt: new Date() }
    );
    await ActiveSession.deleteMany({ poolId: pool._id, userId: target._id });

    pool.currentParticipantCount = await recountParticipants(pool._id);
    await pool.save();

    emitToUser(target.userId, EVENTS.ACCESS.REVOKED, { poolId: pool.poolId, reason: 'removed' });
    emitToPool(pool.poolId, EVENTS.POOL.PARTICIPANT_REMOVED, { poolId: pool.poolId, userId: target.userId });

    return true;
  }

  /* -------------------------------- history ------------------------------- */

  async getPoolHistory(user, query = {}) {
    const { page, limit, skip } = parsePagination(query);

    const statusFilter = {};
    if (query.status) {
      const map = {
        active: PoolStatus.ACTIVE,
        expired: PoolStatus.EXPIRED,
        ended: { $in: ENDED_STATUSES },
      };
      const mapped = map[String(query.status).toLowerCase()];
      if (mapped) statusFilter.poolStatus = mapped;
    }

    let filter;
    if (query.type === 'created') {
      filter = { createdBy: user._id, ...statusFilter };
    } else if (query.type === 'joined') {
      const memberships = await PoolParticipant.find({ userId: user._id }).distinct('poolId');
      filter = { _id: { $in: memberships }, createdBy: { $ne: user._id }, ...statusFilter };
    } else {
      const memberships = await PoolParticipant.find({ userId: user._id }).distinct('poolId');
      filter = { $or: [{ createdBy: user._id }, { _id: { $in: memberships } }], ...statusFilter };
    }

    const [pools, total] = await Promise.all([
      Pool.find(filter)
        .select('-passwordHash -location -localIp -port -allowedUsers')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'userId username name profilePic')
        .lean(),
      Pool.countDocuments(filter),
    ]);

    const items = pools.map((p) => ({
      ...serializePool(p, p.createdBy && p.createdBy._id ? 'member' : 'other'),
      isOwner: p.createdBy && p.createdBy._id && p.createdBy._id.toString() === user._id.toString(),
    }));

    return buildPaginatedResult(items, total, page, limit);
  }

  async getPoolHistoryDetail(user, poolId) {
    const pool = await Pool.findOne({ poolId })
      .select('-passwordHash')
      .populate('createdBy', PUBLIC_USER_FIELDS);
    if (!pool) throw new AppError('Pool not found', STATUS_CODES.NOT_FOUND, ERROR_CODES.POOL_NOT_FOUND);

    const isOwner = pool.createdBy && pool.createdBy._id.toString() === user._id.toString();
    const wasParticipant = await PoolParticipant.exists({ poolId: pool._id, userId: user._id });
    if (!isOwner && !wasParticipant) {
      throw new AppError('Not authorized to view this pool history', STATUS_CODES.FORBIDDEN, ERROR_CODES.ACCESS_DENIED);
    }

    // Historical metadata only. Expired/ended pool CONTENT stays gated behind the
    // active-pool item endpoints, so history never re-opens access to files.
    return serializePool(pool, isOwner ? 'owner' : 'member');
  }
}

module.exports = new PoolService();
