const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
const prisma = new PrismaClient();

// ── POST / — create shop profile (called right after registration) ────────────
router.post(
  '/',
  requireAuth,
  [body('name').trim().notEmpty().withMessage('Shop name is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { shopId, email } = req.user;
    const { name, address, city, phone, gstin } = req.body;

    try {
      const existing = await prisma.shop.findUnique({ where: { shopId } });
      if (existing) return res.status(409).json({ error: 'Shop profile already exists' });

      const shop = await prisma.shop.create({
        data: { shopId, name, ownerEmail: email, address, city, phone, gstin },
      });
      res.status(201).json({ shop });
    } catch (err) {
      console.error('[shop] create error:', err);
      res.status(500).json({ error: 'Failed to create shop' });
    }
  }
);

// ── GET /me — get own shop profile ───────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { shopId: req.user.shopId },
      include: { staff: true },
    });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    res.json({ shop });
  } catch (err) {
    console.error('[shop] get error:', err);
    res.status(500).json({ error: 'Failed to fetch shop' });
  }
});

// ── PUT /me — update own shop profile ────────────────────────────────────────
router.put('/me', requireAuth, async (req, res) => {
  const { name, address, city, phone, gstin } = req.body;
  try {
    const shop = await prisma.shop.update({
      where: { shopId: req.user.shopId },
      data: { name, address, city, phone, gstin },
    });
    res.json({ shop });
  } catch (err) {
    console.error('[shop] update error:', err);
    res.status(500).json({ error: 'Failed to update shop' });
  }
});

// ── GET /me/staff — list staff ────────────────────────────────────────────────
router.get('/me/staff', requireAuth, async (req, res) => {
  try {
    const staff = await prisma.staff.findMany({
      where: { shopId: req.user.shopId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ staff });
  } catch (err) {
    console.error('[shop] staff list error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// ── POST /me/staff — add staff member ────────────────────────────────────────
router.post(
  '/me/staff',
  requireAuth,
  [
    body('name').trim().notEmpty(),
    body('role').isIn(['COUNTER', 'OWNER']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, role } = req.body;
    try {
      const member = await prisma.staff.create({
        data: { shopId: req.user.shopId, name, role },
      });
      res.status(201).json({ member });
    } catch (err) {
      console.error('[shop] add staff error:', err);
      res.status(500).json({ error: 'Failed to add staff member' });
    }
  }
);

// ── DELETE /me/staff/:id — remove staff member ────────────────────────────────
router.delete('/me/staff/:id', requireAuth, async (req, res) => {
  try {
    const member = await prisma.staff.findUnique({ where: { id: req.params.id } });
    if (!member || member.shopId !== req.user.shopId) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    await prisma.staff.delete({ where: { id: req.params.id } });
    res.json({ message: 'Staff member removed' });
  } catch (err) {
    console.error('[shop] delete staff error:', err);
    res.status(500).json({ error: 'Failed to remove staff member' });
  }
});

module.exports = router;
