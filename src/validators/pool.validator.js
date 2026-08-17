const Joi = require('joi');
const { PoolProtocol } = require('../enums/pool.enum');
const { POOL_LIMITS } = require('../constants/app.constants');

const latitude = Joi.number().min(-90).max(90);
const longitude = Joi.number().min(-180).max(180);

const createPoolSchema = Joi.object({
  poolName: Joi.string().min(3).max(100).required(),
  hostDeviceId: Joi.string().required(),
  expiresAt: Joi.date().iso().optional(),
  durationMs: Joi.number().integer().min(POOL_LIMITS.MIN_LIFETIME_MS).max(POOL_LIMITS.MAX_LIFETIME_MS).optional(),
  isPublic: Joi.boolean().optional(),
  passwordProtected: Joi.boolean().optional(),
  password: Joi.string().min(4).max(128).allow(null, '').optional().when('passwordProtected', { is: true, then: Joi.required() }),
  maxParticipants: Joi.number().integer().min(POOL_LIMITS.MIN_PARTICIPANTS).max(POOL_LIMITS.MAX_PARTICIPANTS).optional(),
  discoveryEnabled: Joi.boolean().optional(),
  categories: Joi.array().items(Joi.string().max(40)).max(20).optional(),
  // Discovery location (either flat lat/lng or a nested object).
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  location: Joi.object({ latitude: latitude.required(), longitude: longitude.required() }).optional(),
  localIp: Joi.string().ip().allow(null, '').optional(),
  port: Joi.number().port().allow(null).optional(),
  protocolType: Joi.string().valid(...Object.values(PoolProtocol)).optional(),
})
  // Require both coordinates together if either flat coord is supplied.
  .and('latitude', 'longitude')
  .unknown(true); // forward compatibility for coordination-layer fields

const updatePoolSchema = Joi.object({
  poolName: Joi.string().min(3).max(100).optional(),
  isPublic: Joi.boolean().optional(),
  passwordProtected: Joi.boolean().optional(),
  password: Joi.string().min(4).max(128).allow(null, '').optional(),
  maxParticipants: Joi.number().integer().min(POOL_LIMITS.MIN_PARTICIPANTS).max(POOL_LIMITS.MAX_PARTICIPANTS).optional(),
  expiresAt: Joi.date().iso().optional(),
  durationMs: Joi.number().integer().min(POOL_LIMITS.MIN_LIFETIME_MS).max(POOL_LIMITS.MAX_LIFETIME_MS).optional(),
  discoveryEnabled: Joi.boolean().optional(),
  categories: Joi.array().items(Joi.string().max(40)).max(20).optional(),
}).unknown(true);

const joinPoolSchema = Joi.object({
  password: Joi.string().max(128).allow(null, '').optional(),
}).unknown(true);

const authorizeUserSchema = Joi.object({
  userId: Joi.string().optional(),
  username: Joi.string().optional(),
}).or('userId', 'username');

module.exports = {
  createPoolSchema,
  updatePoolSchema,
  joinPoolSchema,
  authorizeUserSchema,
};
