const express = require('express');
const router = express.Router();
const historyController = require('../controllers/history.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/user', historyController.fetchUserHistory);
router.get('/pool/:poolId', historyController.fetchPoolAnalytics);
router.get('/item/:itemId', historyController.fetchItemAnalytics);

module.exports = router;
