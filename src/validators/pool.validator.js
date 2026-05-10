const Joi = require('joi');
const { PoolProtocol } = require('../enums/pool.enum');

const createPoolSchema = Joi.object({
  poolName: Joi.string().min(3).max(100).required(),
  hostDeviceId: Joi.string().required(),
  expiresAt: Joi.date().iso().optional(),
  isPublic: Joi.boolean().optional(),
  passwordProtected: Joi.boolean().optional(),
  password: Joi.string().min(4).when('passwordProtected', { is: true, then: Joi.required() }),
  localIp: Joi.string().ip().optional(),
  port: Joi.number().port().optional(),
  protocolType: Joi.string().valid(...Object.values(PoolProtocol)).optional(),
});

const updatePoolSchema = Joi.object({
  poolName: Joi.string().min(3).max(100).optional(),
  isPublic: Joi.boolean().optional(),
  passwordProtected: Joi.boolean().optional(),
  password: Joi.string().min(4).optional(),
});

module.exports = {
  createPoolSchema,
  updatePoolSchema,
};
