const crypto = require('crypto');

// Unambiguous alphabet (no 0/O, 1/I) for human-readable / QR-friendly join codes.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const generateCode = (length = 8) => {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
};

/**
 * Generate a pool code that is unique against the provided async checker.
 */
const generateUniquePoolCode = async (isTakenFn, length = 8) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCode(length);
    // eslint-disable-next-line no-await-in-loop
    if (!(await isTakenFn(code))) return code;
  }
  // Fall back to a longer code on repeated collisions.
  return generateCode(length + 4);
};

module.exports = {
  generateCode,
  generateUniquePoolCode,
};
