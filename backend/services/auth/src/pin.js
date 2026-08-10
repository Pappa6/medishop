/**
 * PIN hashing using PBKDF2-SHA256 — ported from the original medishop-app/src/pin.js.
 * Uses Node's built-in crypto instead of @noble/hashes so no extra dependency is needed.
 */
const crypto = require('crypto');

const ITERATIONS = 100_000;
const KEY_LEN = 32;
const DIGEST = 'sha256';

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(pin, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `v2:${salt}:${derived}`;
}

function verifyPin(pin, storedHash) {
  if (!storedHash) return false;

  if (storedHash.startsWith('v2:')) {
    const [, salt, expected] = storedHash.split(':');
    const derived = crypto.pbkdf2Sync(pin, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(expected));
  }

  // Legacy plain SHA-256 (backward compat with old app data)
  const legacy = crypto.createHash('sha256').update(pin).digest('hex');
  return legacy === storedHash;
}

module.exports = { hashPin, verifyPin };
