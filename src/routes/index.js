const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const poolRoutes = require('./pool.routes');
const userRoutes = require('./user.routes');
const poolItemRoutes = require('./poolItem.routes');
const historyRoutes = require('./history.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/pools', poolRoutes);
router.use('/pools/:poolId/items', poolItemRoutes);
router.use('/history', historyRoutes);

// Health check endpoint
const mongoose = require('mongoose');

router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    success: true,
    status: 'OK',
    uptime: process.uptime(),
    database: dbStatus[dbState] || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
