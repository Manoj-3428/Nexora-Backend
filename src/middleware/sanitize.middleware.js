const mongoSanitize = require('express-mongo-sanitize');

/**
 * Request sanitization for Express 5.
 *
 * NOTE: The stock `express-mongo-sanitize()` and `xss-clean()` middlewares
 * REASSIGN `req.query`, which is a read-only getter in Express 5 and throws.
 * We therefore sanitize each container IN PLACE (mutating the existing object)
 * using the library's standalone `sanitize()` helper — no reassignment.
 */

// Escape the two characters that let a string break out into HTML markup.
// Non-destructive (keeps content) and prevents stored/reflected HTML injection.
const escapeHtml = (value) => value.replace(/</g, '&lt;').replace(/>/g, '&gt;');

const deepEscapeStrings = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach((key) => {
    const val = obj[key];
    if (typeof val === 'string') {
      obj[key] = escapeHtml(val);
    } else if (val && typeof val === 'object') {
      deepEscapeStrings(val);
    }
  });
};

/**
 * Strip MongoDB operator injection ($-prefixed / dotted keys) and neutralize
 * basic HTML in string inputs. Applied to body/query/params in place.
 */
const sanitizeRequest = (req, res, next) => {
  ['body', 'params', 'query'].forEach((key) => {
    const container = req[key];
    if (container && typeof container === 'object') {
      try {
        // Removes/neutralizes keys containing `$` or `.` (NoSQL injection vectors).
        mongoSanitize.sanitize(container, { replaceWith: '_' });
      } catch (_) {
        /* read-only container (Express 5 query) — safe to ignore */
      }
    }
  });

  // XSS: only body is escaped; query/params feed typed/normalized lookups already.
  if (req.body && typeof req.body === 'object') {
    deepEscapeStrings(req.body);
  }

  next();
};

module.exports = sanitizeRequest;
