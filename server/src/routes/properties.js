const express = require('express');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createPropertySchema, joinPropertySchema } = require('../validation/schemas');

const router = express.Router();

function generateJoinCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A1B2C3D4"
}

// Landlord creates a property
router.post('/', requireAuth, requireRole('LANDLORD'), async (req, res) => {
  const { address, unitName } = createPropertySchema.parse(req.body);

  const property = await prisma.property.create({
    data: {
      address,
      unitName: unitName || null,
      joinCode: generateJoinCode(),
      landlordId: req.user.id,
    },
  });

  res.status(201).json({ property });
});

// List properties visible to the current user
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'LANDLORD') {
    const properties = await prisma.property.findMany({
      where: { landlordId: req.user.id },
      include: { tenants: { select: { id: true, name: true, email: true } } },
    });
    return res.json({ properties });
  }

  // TENANT: their single joined property, if any
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { property: true },
  });
  res.json({ properties: user.property ? [user.property] : [] });
});

// Tenant joins a property via code
router.post('/join', requireAuth, requireRole('TENANT'), async (req, res) => {
  const { joinCode } = joinPropertySchema.parse(req.body);

  const property = await prisma.property.findUnique({ where: { joinCode } });
  if (!property) {
    return res.status(404).json({ error: 'Invalid join code' });
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { propertyId: property.id },
  });

  res.json({ property });
});

module.exports = router;
