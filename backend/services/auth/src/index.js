require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'medishop-auth', timestamp: new Date().toISOString() });
});

app.use('/', authRoutes);

app.use((err, req, res, next) => {
  console.error('[auth] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[auth-service] running on port ${PORT}`);
});
