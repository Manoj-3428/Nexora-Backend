require('dotenv').config();

const requiredEnvs = ['JWT_SECRET', 'MONGODB_URI'];
requiredEnvs.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`FATAL ERROR: Environment variable ${envVar} is missing.`);
    process.exit(1);
  }
});

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV || 'development',
};
