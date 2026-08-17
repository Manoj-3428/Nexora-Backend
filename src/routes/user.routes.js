const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

// Current user
router.get('/me', userController.getMe);
router.patch('/me', userController.updateProfile);

// Username availability + search (username-optimized lookup for adding to pools)
router.get('/username/check', userController.checkUsername);
router.get('/search', userController.searchUsers);

// Backward-compatible profile routes
router.put('/profile', userController.updateProfile);
router.patch('/connection-status', userController.updateConnectionStatus);

module.exports = router;
