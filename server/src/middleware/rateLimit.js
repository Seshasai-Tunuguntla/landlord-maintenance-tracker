const rateLimit = require('express-rate-limit');
const { isDemoEmail } = require('../demo/demo');

const MINUTE = 60 * 1000;
const common = { standardHeaders: true, legacyHeaders: false };

const emailOf = (req) => String(req.body?.email ?? '').trim().toLowerCase();

// Client IPs arrive through three proxies (Vercel, Cloudflare, Render), so the limits that
// protect accounts key on the account or user instead of the IP.

// Password guessing: failed logins per account. Successful logins never count, and the demo
// accounts (whose password is public) are exempt so the "Try as" buttons always work.
const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${emailOf(req)}`,
  skip: (req) => isDemoEmail(emailOf(req)),
  message: { error: 'Too many failed attempts for this account. Try again in 15 minutes.' },
});

// Join-code guessing: wrong codes per logged-in user.
const joinLimiter = rateLimit({
  ...common,
  windowMs: 60 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `join:${req.user.id}`,
  message: { error: 'Too many wrong join codes. Try again in an hour.' },
});

// Sign-ups have no account yet, so this one keys on the connecting IP (see trust proxy in app.js).
// Off under test, where every request comes from the same address.
const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * MINUTE,
  limit: 20,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many sign-ups from this network. Try again later.' },
});

module.exports = { loginLimiter, joinLimiter, registerLimiter };
