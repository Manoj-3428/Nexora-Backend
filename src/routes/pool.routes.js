const express = require('express');
const router = express.Router();
const poolController = require('../controllers/pool.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createPoolSchema, updatePoolSchema } = require('../validators/pool.validator');
const { isPoolOwner } = require('../middleware/pool.middleware');

router.use(protect); // All pool routes require authentication

router.post('/', validate(createPoolSchema), poolController.createPool);
router.get('/nearby', poolController.fetchNearbyPools);
router.get('/:poolId', poolController.getPoolDetails);
router.put('/:poolId', isPoolOwner, validate(updatePoolSchema), poolController.updatePool);
router.delete('/:poolId', isPoolOwner, poolController.deletePool);
router.patch('/:poolId/close', isPoolOwner, poolController.closePool);
router.post('/:poolId/join', poolController.joinPool);
router.post('/:poolId/leave', poolController.leavePool);
router.post('/:poolId/verify-password', poolController.verifyPassword);

module.exports = router;
