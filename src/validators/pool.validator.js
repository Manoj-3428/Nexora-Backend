const Joi = require('joi');
const { PoolProtocol } = require('../enums/pool.enum');

const createPoolSchema = Joi.object({
  poolName: Joi.string().min(3).max(100).required(),
  hostDeviceId: Joi.string().required(),
  expiresAt: Joi.date().iso().optional(),
  isPublic: Joi.boolean().optional(),
  passwordProtected: Joi.boolean().optional(),
  password: Joi.string().min(4).allow(null, '').optional().when('passwordProtected', { is: true, then: Joi.required() }),
  localIp: Joi.string().ip().allow(null, '').optional(),
  port: Joi.number().port().allow(null).optional(),
  protocolType: Joi.string().valid(...Object.values(PoolProtocol)).optional(),
}).unknown(true); // Allow unknown fields for forward compatibility in coordination layer

const updatePoolSchema = Joi.object({
  poolName: Joi.string().min(3).max(100).optional(),
  isPublic: Joi.boolean().optional(),
  passwordProtected: Joi.boolean().optional(),
  password: Joi.string().min(4).allow(null, '').optional(),
}).unknown(true);

module.exports = {
  createPoolSchema,
  updatePoolSchema,
};
