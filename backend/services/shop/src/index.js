require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const shopRoutes = require('./routes/shops');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'medishop-shop', timestamp: new Date().toISOString() });
});

app.use('/', shopRoutes);

app.use((err, req, res, next) => {
  console.error('[shop] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[shop-service] running on port ${PORT}`);
});
