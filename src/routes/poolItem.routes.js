const express = require('express');
const router = express.Router({ mergeParams: true }); // Merge params to access poolId from parent router
const poolItemController = require('../controllers/poolItem.controller');
const { protect } = require('../middleware/auth.middleware');
const { isPoolOwner, isAllowedUser } = require('../middleware/pool.middleware');

router.use(protect);

router.post('/', isPoolOwner, poolItemController.addPoolItem);
router.get('/', isAllowedUser, poolItemController.fetchPoolItems);
router.get('/:itemId', isAllowedUser, poolItemController.fetchItemDetails);
router.put('/:itemId', isPoolOwner, poolItemController.updateItemMetadata);
router.delete('/:itemId', isPoolOwner, poolItemController.removePoolItem);

module.exports = router;
