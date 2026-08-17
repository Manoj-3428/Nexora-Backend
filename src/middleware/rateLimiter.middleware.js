const rateLimit = require('express-rate-limit');

// Rate limiting is bypassed under the test environment so a full suite sharing
// one client IP does not trip the limiter.
const skipInTest = () => process.env.NODE_ENV === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per `window` (here, per 15 minutes)
  message: {
    success: false,
    message: 'Too many auth requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 general API requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

module.exports = {
  authLimiter,
  apiLimiter,
};
