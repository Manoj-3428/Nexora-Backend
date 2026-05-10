const jwt = require('jsonwebtoken');
const envConfig = require('../config/env.config');

const generateToken = (payload, expiresIn = '30d') => {
  return jwt.sign(payload, envConfig.JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  return jwt.verify(token, envConfig.JWT_SECRET);
};

module.exports = {
  generateToken,
  verifyToken,
};
