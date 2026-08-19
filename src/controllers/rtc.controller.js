const crypto = require('crypto');
const { successResponse } = require('../utils/response.util');

/**
 * Returns ICE servers for the mobile WebRTC layer.
 *
 * - STUN is always included (host + server-reflexive candidates).
 * - TURN is included when configured, and is REQUIRED for reliable cross-network
 *   (symmetric-NAT / cellular) peer connections.
 *
 * Two TURN modes:
 *  1. Ephemeral (production, scalable): set TURN_SECRET (shared with coturn's
 *     `use-auth-secret` / `static-auth-secret`). We mint short-lived, time-limited
 *     credentials per request via the coturn REST API scheme (HMAC-SHA1), so no
 *     long-lived TURN password is ever shipped to clients.
 *  2. Static: set TURN_USERNAME + TURN_CREDENTIAL for a fixed credential.
 *
 * Env:
 *   STUN_URLS      comma-separated (default: stun:stun.l.google.com:19302)
 *   TURN_URLS      comma-separated (e.g. turn:turn.nexora.example:3478?transport=udp)
 *   TURN_SECRET    shared secret for ephemeral credentials
 *   TURN_TTL       credential lifetime in seconds (default 86400)
 *   TURN_USERNAME / TURN_CREDENTIAL   static fallback
 */
const getIceServers = async (req, res) => {
  const iceServers = [];

  const stunUrls = String(process.env.STUN_URLS || 'stun:stun.l.google.com:19302')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (stunUrls.length) iceServers.push({ urls: stunUrls });

  const turnUrls = String(process.env.TURN_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (turnUrls.length) {
    if (process.env.TURN_SECRET) {
      const ttl = parseInt(process.env.TURN_TTL || '86400', 10);
      // coturn REST API: username = "<unix-expiry>:<id>", credential = base64(HMAC-SHA1(secret, username)).
      const username = `${Math.floor(Date.now() / 1000) + ttl}:nexora`;
      const credential = crypto
        .createHmac('sha1', process.env.TURN_SECRET)
        .update(username)
        .digest('base64');
      iceServers.push({ urls: turnUrls, username, credential });
    } else if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      iceServers.push({
        urls: turnUrls,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      });
    }
  }

  return successResponse(res, 'ICE servers retrieved', { iceServers });
};

module.exports = { getIceServers };
