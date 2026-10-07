const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Photos can show the inside of someone's home, so only the tenant who filed the request and
// the landlord who owns the property may see them. <img> tags send the login cookie because
// the site and API share an origin. Everyone else gets 404, so ids reveal nothing.
router.get('/:id', requireAuth, async (req, res) => {
  const photo = await prisma.photo.findUnique({
    where: { id: req.params.id },
    include: { request: { select: { tenantId: true, property: { select: { landlordId: true } } } } },
  });

  const request = photo?.request;
  const allowed = request && (request.tenantId === req.user.id || request.property.landlordId === req.user.id);
  if (!allowed) return res.status(404).json({ error: 'Photo not found' });

  res.set('Content-Type', photo.mimeType);
  // The browser may keep a copy but must ask again each time (cheap: 304 via ETag), so after
  // logout the photo can't be reopened from cache on a shared computer.
  res.set('Cache-Control', 'private, no-cache');
  res.send(Buffer.from(photo.data));
});

module.exports = router;
