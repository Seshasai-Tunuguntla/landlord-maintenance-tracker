const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, requireRole } = require('../middleware/auth');
const { joinLimiter } = require('../middleware/rateLimit');
const { createPropertySchema, joinPropertySchema } = require('../validation/schemas');
const { generateJoinCode } = require('../utils/joinCode');
const { isDemoEmail } = require('../demo/demo');

const router = express.Router();

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
router.post('/join', requireAuth, requireRole('TENANT'), joinLimiter, async (req, res) => {
  const { joinCode } = joinPropertySchema.parse(req.body);

  if (isDemoEmail(req.user.email)) {
    return res.status(403).json({ error: "The demo tenant can't join other properties. Create your own account to try joining." });
  }

  const found = await prisma.property.findUnique({
    where: { joinCode },
    include: { landlord: { select: { email: true } } },
  });
  if (!found) {
    return res.status(404).json({ error: 'Invalid join code' });
  }
  const { landlord, ...property } = found;
  if (isDemoEmail(landlord.email)) {
    return res.status(403).json({ error: 'That join code belongs to the demo. Create a landlord account to get your own.' });
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { propertyId: property.id },
  });

  res.json({ property });
});

module.exports = router;
