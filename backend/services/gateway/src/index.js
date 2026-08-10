require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security & logging ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// ── Rate limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter limit on login/register
  message: { error: 'Too many auth attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'medishop-gateway',
    timestamp: new Date().toISOString(),
  });
});

// ── JWT verification (skips public routes) ───────────────────────────────────
app.use(authMiddleware);

// ── Service proxies ───────────────────────────────────────────────────────────
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const SHOP_SERVICE_URL = process.env.SHOP_SERVICE_URL || 'http://localhost:3002';

app.use(
  '/api/auth',
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '' },
    on: {
      error: (err, req, res) => {
        res.status(502).json({ error: 'Auth service unavailable' });
      },
    },
  })
);

app.use(
  '/api/shops',
  createProxyMiddleware({
    target: SHOP_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/shops': '' },
    on: {
      error: (err, req, res) => {
        res.status(502).json({ error: 'Shop service unavailable' });
      },
    },
  })
);

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.listen(PORT, () => {
  console.log(`[gateway] running on port ${PORT}`);
});
