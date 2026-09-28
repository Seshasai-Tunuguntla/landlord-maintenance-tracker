const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const prisma = require('../prismaClient');
const { requireAuth, requireRole } = require('../middleware/auth');
const { detectPriority } = require('../utils/priority');
const { createRequestSchema, updateStatusSchema } = require('../validation/schemas');

const router = express.Router();

// No SVG: it can carry scripts that would run on our origin when the photo URL is opened.
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_PHOTO_TYPES.includes(file.mimetype)) {
      const err = new Error('Photo must be a JPEG, PNG, WebP, or GIF image');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// Tenant creates a maintenance request (with optional photo)
router.post(
  '/',
  requireAuth,
  requireRole('TENANT'),
  upload.single('photo'),
  async (req, res) => {
    const { title, description, priority: requestedPriority } = createRequestSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.propertyId) {
      return res.status(400).json({ error: 'You must join a property before submitting a request' });
    }

    const priority = detectPriority(title, description, requestedPriority);
    const photoId = req.file ? crypto.randomUUID() : null;

    const request = await prisma.$transaction(async (tx) => {
      if (photoId) {
        await tx.photo.create({
          data: { id: photoId, mimeType: req.file.mimetype, data: req.file.buffer },
        });
      }
      return tx.maintenanceRequest.create({
        data: {
          title,
          description,
          photoId,
          photoUrl: photoId ? `/api/photos/${photoId}` : null,
          priority,
          status: 'OPEN',
          tenantId: user.id,
          propertyId: user.propertyId,
          statusHistory: { create: { status: 'OPEN', changedById: user.id } },
        },
        include: { statusHistory: true },
      });
    });

    res.status(201).json({ request });
  }
);

// List requests, role-filtered
router.get('/', requireAuth, async (req, res) => {
  const statusHistoryInclude = {
    orderBy: { changedAt: 'asc' },
    include: { changedBy: { select: { id: true, name: true, role: true } } },
  };

  if (req.user.role === 'TENANT') {
    const requests = await prisma.maintenanceRequest.findMany({
      where: { tenantId: req.user.id },
      include: { statusHistory: statusHistoryInclude },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ requests });
  }

  // LANDLORD: requests across all properties they own
  const requests = await prisma.maintenanceRequest.findMany({
    where: { property: { landlordId: req.user.id } },
    include: {
      tenant: { select: { id: true, name: true, email: true } },
      property: { select: { id: true, address: true, unitName: true } },
      statusHistory: statusHistoryInclude,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ requests });
});

// Get one request by id
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid request id' });

  const request = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, name: true, email: true } },
      property: true,
      statusHistory: {
        orderBy: { changedAt: 'asc' },
        include: { changedBy: { select: { id: true, name: true, role: true } } },
      },
    },
  });

  if (!request) return res.status(404).json({ error: 'Request not found' });

  const isOwnerTenant = req.user.role === 'TENANT' && request.tenantId === req.user.id;
  const isOwnerLandlord = req.user.role === 'LANDLORD' && request.property.landlordId === req.user.id;
  if (!isOwnerTenant && !isOwnerLandlord) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json({ request });
});

// Landlord updates status
router.patch('/:id/status', requireAuth, requireRole('LANDLORD'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid request id' });
  const { status } = updateStatusSchema.parse(req.body);

  const request = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: { property: true },
  });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.property.landlordId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: {
      status,
      statusHistory: { create: { status, changedById: req.user.id } },
    },
    include: {
      statusHistory: {
        orderBy: { changedAt: 'asc' },
        include: { changedBy: { select: { id: true, name: true, role: true } } },
      },
    },
  });

  res.json({ request: updated });
});

module.exports = router;
