const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');
const validate = require('../middleware/validate.middleware');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

router.post('/register', authLimiter, validate(registerSchema), authController.registerUser);
router.post('/login', authLimiter, validate(loginSchema), authController.loginUser);
router.post('/logout', protect, authController.logoutUser);
router.get('/profile', protect, authController.getProfile);

module.exports = router;
