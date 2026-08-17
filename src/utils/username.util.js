const crypto = require('crypto');

// Allowed final form: lowercase letters, digits, underscore; 3-30 chars.
const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

const normalizeUsername = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '') // strip disallowed chars
    .slice(0, 30);
};

const isValidUsername = (raw) => USERNAME_REGEX.test(normalizeUsername(raw));

/**
 * Build a base username suggestion from first + last name (or a full name).
 * e.g. ("John", "Doe") => "john_doe"
 */
const buildBaseUsername = (firstName = '', lastName = '') => {
  const base = `${firstName || ''}_${lastName || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  let candidate = base.slice(0, 24);
  if (candidate.length < 3) {
    candidate = `user_${crypto.randomBytes(3).toString('hex')}`;
  }
  return candidate;
};

/**
 * Given a base and an async availability checker, return the first available username.
 * Appends a numeric suffix on collision.
 */
const generateAvailableUsername = async (base, isTakenFn) => {
  const normalizedBase = normalizeUsername(base) || `user_${crypto.randomBytes(3).toString('hex')}`;
  if (!(await isTakenFn(normalizedBase))) return normalizedBase;

  for (let i = 1; i <= 9999; i += 1) {
    const suffix = String(i);
    const candidate = `${normalizedBase.slice(0, 30 - suffix.length)}${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await isTakenFn(candidate))) return candidate;
  }
  // Extremely unlikely fallback.
  return `${normalizedBase.slice(0, 22)}_${crypto.randomBytes(3).toString('hex')}`;
};

module.exports = {
  USERNAME_REGEX,
  normalizeUsername,
  isValidUsername,
  buildBaseUsername,
  generateAvailableUsername,
};
