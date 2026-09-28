const rateLimit = require('express-rate-limit');

// Disabled under test: the suite legitimately fires far more than 20
// register/login calls in a short window, which isn't the brute-force
// pattern this limiter exists to slow down.
const authLimiter =
  process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many attempts, please try again later' },
      });

module.exports = { authLimiter };
