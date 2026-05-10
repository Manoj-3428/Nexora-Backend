const mongoose = require('mongoose');
const logger = require('../utils/logger.util');
const envConfig = require('../config/env.config');

const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(envConfig.MONGODB_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDatabase;
