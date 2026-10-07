const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const requestRoutes = require('./routes/requests');
const photoRoutes = require('./routes/photos');

const app = express();

// On Render, X-Forwarded-For arrives as "<client>, <Cloudflare edge>, <Render proxy>" and the socket
// is another Render proxy (measured Oct 2026). Trusting 3 hops makes req.ip the address that
// connected to Cloudflare, which a caller can't forge. Traffic proxied by Vercel shows up as a
// Vercel address, which is why account protection doesn't key on IPs (see middleware/rateLimit.js).
app.set('trust proxy', 3);

const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (curl, Thunder Client) which send no Origin header.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/photos', photoRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0].message, details: err.issues });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: `${err.meta?.target?.join(', ') || 'Field'} already in use` });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found' });
    }
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Photo must be 5MB or smaller' });
  }
  if (err.status === 400) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
