const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/', activityController.fetchActivity);

module.exports = router;
