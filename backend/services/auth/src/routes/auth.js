const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { issueAccessToken, issueRefreshToken } = require('../tokens');
const { hashPin, verifyPin } = require('../pin');

const router = express.Router();
const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

// PIN lockout config — mirrors original RoleSelectScreen.js logic
const LOCKOUT_STEPS_MS = [30_000, 120_000, 300_000, 600_000, 1_800_000];
const MAX_PIN_ATTEMPTS = 5;

// ── POST /register ────────────────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('shopName').trim().notEmpty().withMessage('Shop name is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, shopName } = req.body;

    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await prisma.user.create({
        data: { email, passwordHash },
      });

      const accessToken = issueAccessToken({
        sub: user.id,
        shopId: user.shopId,
        email: user.email,
      });
      const refreshTokenValue = issueRefreshToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({
        data: { token: refreshTokenValue, userId: user.id, expiresAt },
      });

      res.status(201).json({
        accessToken,
        refreshToken: refreshTokenValue,
        user: {
          id: user.id,
          shopId: user.shopId,
          email: user.email,
          pinChangeRequired: user.pinChangeRequired,
        },
      });
    } catch (err) {
      console.error('[auth] register error:', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// ── POST /login ───────────────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) return res.status(401).json({ error: 'Invalid email or password' });

      const accessToken = issueAccessToken({
        sub: user.id,
        shopId: user.shopId,
        email: user.email,
      });
      const refreshTokenValue = issueRefreshToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({
        data: { token: refreshTokenValue, userId: user.id, expiresAt },
      });

      res.json({
        accessToken,
        refreshToken: refreshTokenValue,
        user: {
          id: user.id,
          shopId: user.shopId,
          email: user.email,
          pinChangeRequired: user.pinChangeRequired,
        },
      });
    } catch (err) {
      console.error('[auth] login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ── POST /refresh ─────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

  try {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const newRefresh = issueRefreshToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { token: newRefresh, userId: stored.userId, expiresAt },
    });

    const accessToken = issueAccessToken({
      sub: stored.user.id,
      shopId: stored.user.shopId,
      email: stored.user.email,
    });

    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    console.error('[auth] refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
  }
  res.json({ message: 'Logged out' });
});

// ── POST /pin/set ─────────────────────────────────────────────────────────────
router.post(
  '/pin/set',
  [body('pin').isLength({ min: 4, max: 6 }).withMessage('PIN must be 4–6 digits')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { pin } = req.body;
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be numeric' });

    try {
      const pinHash = hashPin(pin);
      await prisma.user.update({
        where: { id: userId },
        data: { pinHash, pinChangeRequired: false, failedPinAttempts: 0, pinLockedUntil: null },
      });
      res.json({ message: 'PIN updated successfully' });
    } catch (err) {
      console.error('[auth] pin/set error:', err);
      res.status(500).json({ error: 'Failed to set PIN' });
    }
  }
);

// ── POST /pin/verify ──────────────────────────────────────────────────────────
router.post('/pin/verify', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'pin required' });

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.pinHash) return res.status(400).json({ error: 'No PIN set' });

    // Check lockout
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      const remaining = Math.ceil((user.pinLockedUntil - Date.now()) / 1000);
      return res.status(429).json({ error: 'PIN locked', lockedForSeconds: remaining });
    }

    const valid = verifyPin(pin, user.pinHash);
    if (!valid) {
      const attempts = user.failedPinAttempts + 1;
      const lockStep = Math.min(attempts - 1, LOCKOUT_STEPS_MS.length - 1);
      const pinLockedUntil =
        attempts >= MAX_PIN_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_STEPS_MS[lockStep])
          : null;
      await prisma.user.update({
        where: { id: userId },
        data: { failedPinAttempts: attempts, pinLockedUntil },
      });
      return res.status(401).json({ error: 'Incorrect PIN', attempts });
    }

    // Reset on success
    await prisma.user.update({
      where: { id: userId },
      data: { failedPinAttempts: 0, pinLockedUntil: null },
    });
    res.json({ valid: true });
  } catch (err) {
    console.error('[auth] pin/verify error:', err);
    res.status(500).json({ error: 'PIN verification failed' });
  }
});

module.exports = router;
