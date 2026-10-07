const jwt = require('jsonwebtoken');

const AUTH_COOKIE = 'token';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

// httpOnly keeps the token out of reach of page scripts (so XSS can't steal it); SameSite=Strict
// stops browsers sending it on requests started by other sites, which is the CSRF defence.
// vercel.app is on the Public Suffix List, so other *.vercel.app sites count as other sites.
function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
}

function setAuthCookie(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
  res.cookie(AUTH_COOKIE, token, { ...authCookieOptions(), maxAge: SESSION_MS });
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, authCookieOptions());
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role, email }
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden for this role' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, setAuthCookie, clearAuthCookie };
