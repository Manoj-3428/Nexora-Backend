const Joi = require('joi');

// Register accepts either a legacy `name`, or firstName + lastName (preferred).
// `username` is optional; when omitted the backend generates one.
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9_]{3,30}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Username must be 3-30 chars: letters, numbers, underscore.' }),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  deviceId: Joi.string().required(),
})
  .or('name', 'firstName')
  .messages({ 'object.missing': 'Provide either name, or firstName and lastName.' });

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  deviceId: Joi.string().required(),
});

module.exports = {
  registerSchema,
  loginSchema,
};
