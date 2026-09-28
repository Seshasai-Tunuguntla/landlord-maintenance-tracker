const express = require('express');
const prisma = require('../prismaClient');

const router = express.Router();

// Public on purpose: <img> tags can't send the Authorization header.
// Photo ids are random UUIDs, so they can't be guessed or enumerated.
router.get('/:id', async (req, res) => {
  const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  res.set('Content-Type', photo.mimeType);
  res.set('Cache-Control', 'private, max-age=86400');
  res.send(Buffer.from(photo.data));
});

module.exports = router;
