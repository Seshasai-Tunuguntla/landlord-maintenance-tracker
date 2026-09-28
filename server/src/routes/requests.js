const express = require('express');
const multer = require('multer');
const path = require('path');
const prisma = require('../prismaClient');
const { requireAuth, requireRole } = require('../middleware/auth');
const { detectPriority } = require('../utils/priority');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage });

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

// Tenant creates a maintenance request (with optional photo)
router.post(
  '/',
  requireAuth,
  requireRole('TENANT'),
  upload.single('photo'),
  async (req, res) => {
    const { title, description, priority: requestedPriority } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.propertyId) {
      return res.status(400).json({ error: 'You must join a property before submitting a request' });
    }

    const priority = detectPriority(title, description, requestedPriority);
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const request = await prisma.maintenanceRequest.create({
      data: {
        title,
        description,
        photoUrl,
        priority,
        status: 'OPEN',
        tenantId: user.id,
        propertyId: user.propertyId,
        statusHistory: { create: { status: 'OPEN', changedById: user.id } },
      },
      include: { statusHistory: true },
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
  const { status } = req.body;

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  }

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
