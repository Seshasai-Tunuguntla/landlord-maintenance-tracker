const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const prisma = require('../prismaClient');
const { requireAuth, requireRole } = require('../middleware/auth');
const { detectPriority } = require('../utils/priority');
const { createRequestSchema, listRequestsQuerySchema, updateStatusSchema } = require('../validation/schemas');

const router = express.Router();

// No SVG: it can carry scripts that would run on our origin when the photo URL is opened.
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const STATUS_WORDS = { OPEN: 'open', IN_PROGRESS: 'in progress', RESOLVED: 'resolved' };

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

const statusHistoryInclude = {
  orderBy: { changedAt: 'asc' },
  include: { changedBy: { select: { id: true, name: true, role: true } } },
};

// List requests, scoped to the user's role, with optional status/priority filters and paging.
router.get('/', requireAuth, async (req, res) => {
  const { status, priority, page, pageSize } = listRequestsQuerySchema.parse(req.query);
  const isTenant = req.user.role === 'TENANT';

  // Tenants see what they filed; landlords see everything on properties they own.
  const scope = isTenant ? { tenantId: req.user.id } : { property: { landlordId: req.user.id } };
  const where = { ...scope, ...(status && { status }), ...(priority && { priority }) };

  const [requests, total] = await prisma.$transaction([
    prisma.maintenanceRequest.findMany({
      where,
      include: isTenant
        ? { statusHistory: statusHistoryInclude }
        : {
            tenant: { select: { id: true, name: true, email: true } },
            property: { select: { id: true, address: true, unitName: true } },
            statusHistory: statusHistoryInclude,
          },
      // id breaks ties so paging never repeats or skips a request.
      orderBy: isTenant
        ? [{ createdAt: 'desc' }, { id: 'desc' }]
        : [{ priority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.maintenanceRequest.count({ where }),
  ]);

  const body = { requests, total, page, pageSize };

  // The landlord's headline counts ignore filters and paging.
  if (!isTenant) {
    const unresolved = { ...scope, status: { not: 'RESOLVED' } };
    const [open, urgent] = await prisma.$transaction([
      prisma.maintenanceRequest.count({ where: unresolved }),
      prisma.maintenanceRequest.count({ where: { ...unresolved, priority: 'URGENT' } }),
    ]);
    body.summary = { open, urgent };
  }

  res.json(body);
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
      statusHistory: statusHistoryInclude,
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

  // Any move to a *different* status is allowed, including reopening a resolved request,
  // because repairs do come back. Repeating the current status is rejected so the history
  // only records real changes. The conditional update makes that check atomic, so two
  // clicks at once can't both get through.
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.maintenanceRequest.updateMany({
      where: { id, status: { not: status } },
      data: { status },
    });
    if (count === 0) return null;
    await tx.statusHistoryEntry.create({ data: { requestId: id, status, changedById: req.user.id } });
    return tx.maintenanceRequest.findUnique({ where: { id }, include: { statusHistory: statusHistoryInclude } });
  });

  if (!updated) {
    return res.status(409).json({ error: `This request is already ${STATUS_WORDS[status]}.` });
  }
  res.json({ request: updated });
});

module.exports = router;
