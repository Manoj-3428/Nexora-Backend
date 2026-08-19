const express = require('express');
const router = express.Router();
const rtcController = require('../controllers/rtc.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

// ICE (STUN/TURN) servers for the WebRTC peer connection.
router.get('/ice-servers', rtcController.getIceServers);

module.exports = router;
