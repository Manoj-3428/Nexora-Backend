const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;
let app;

/**
 * Boot an ephemeral MongoDB + load the real Express app.
 * Env vars MUST be set before requiring the app (env.config validates at load).
 */
const setupTestApp = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);
  // Ensure indexes (2dsphere, unique username, etc.) are built for the tests.
  app = require('../../src/app');
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes().catch(() => {})));
  return app;
};

const teardownTestApp = async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};

const clearDatabase = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

module.exports = { setupTestApp, teardownTestApp, clearDatabase, getApp: () => app };
