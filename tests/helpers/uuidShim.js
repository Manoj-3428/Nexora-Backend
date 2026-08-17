// Test-only CommonJS shim for the ESM-only `uuid` package so Jest can require it.
// Production code keeps using the real `uuid` dependency.
const crypto = require('crypto');

module.exports = {
  v4: () => crypto.randomUUID(),
};
