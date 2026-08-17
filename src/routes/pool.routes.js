const express = require('express');
const router = express.Router();
const poolController = require('../controllers/pool.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createPoolSchema, updatePoolSchema, joinPoolSchema, authorizeUserSchema } = require('../validators/pool.validator');
const { isPoolOwner } = require('../middleware/pool.middleware');

router.use(protect); // All pool routes require authentication

// --- Collection + discovery (static paths BEFORE :poolId) ---
router.post('/', validate(createPoolSchema), poolController.createPool);
router.get('/discover', poolController.discoverPools); // ~5km geospatial discovery
router.get('/discover/nearby', poolController.fetchNearbyPools);
router.get('/nearby', poolController.fetchNearbyPools); // backward compatible
router.get('/history', poolController.getPoolHistory);
router.get('/code/:code', poolController.getPoolByCode);

// --- Single pool ---
router.get('/:poolId', poolController.getPoolDetails);
router.get('/:poolId/history', poolController.getPoolHistoryDetail);
router.put('/:poolId', isPoolOwner, validate(updatePoolSchema), poolController.updatePool);
router.patch('/:poolId', isPoolOwner, validate(updatePoolSchema), poolController.updatePool);
router.delete('/:poolId', isPoolOwner, poolController.deletePool);

// --- Lifecycle ---
router.patch('/:poolId/close', isPoolOwner, poolController.closePool); // backward compatible
router.post('/:poolId/end', poolController.endPool);

// --- Membership ---
router.post('/:poolId/join', validate(joinPoolSchema), poolController.joinPool);
router.post('/:poolId/leave', poolController.leavePool);
router.post('/:poolId/verify-password', poolController.verifyPassword);

// --- Authorized users (owner-managed) ---
router.get('/:poolId/authorized-users', poolController.listAuthorizedUsers);
router.post('/:poolId/authorized-users', validate(authorizeUserSchema), poolController.addAuthorizedUser);
router.delete('/:poolId/authorized-users/:userId', poolController.removeAuthorizedUser);

// --- Participants ---
router.get('/:poolId/participants', poolController.listParticipants);
router.delete('/:poolId/participants/:userId', poolController.removeParticipant);
router.post('/:poolId/participants/:userId/remove', poolController.removeParticipant);

module.exports = router;
