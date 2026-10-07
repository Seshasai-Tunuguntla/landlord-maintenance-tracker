const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prismaClient');
const { requireAuth, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');
const { registerSchema, loginSchema } = require('../validation/schemas');
const { isDemoEmail, resetDemoDataIfStale } = require('../demo/demo');

const router = express.Router();

function toPublicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

router.post('/register', registerLimiter, async (req, res) => {
  const { name, email, password, role } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, password: hashed, role },
  });

  setAuthCookie(res, user);
  res.status(201).json({ user: toPublicUser(user) });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (isDemoEmail(email)) {
    await resetDemoDataIfStale(prisma);
    const fresh = await prisma.user.findUnique({ where: { email } });
    setAuthCookie(res, fresh);
    return res.json({ user: toPublicUser(fresh) });
  }

  setAuthCookie(res, user);
  res.json({ user: toPublicUser(user) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json({ user: toPublicUser(user) });
});

module.exports = router;
