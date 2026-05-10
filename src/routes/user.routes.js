const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.put('/profile', userController.updateProfile);
router.patch('/connection-status', userController.updateConnectionStatus);

module.exports = router;
