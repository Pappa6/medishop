const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function issueAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  });
}

function issueRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { issueAccessToken, issueRefreshToken, verifyAccessToken };
