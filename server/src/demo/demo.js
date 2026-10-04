const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { generateJoinCode } = require('../utils/joinCode');

// Public demo accounts behind the "Try as a landlord / tenant" buttons. Anyone can change their
// data, so it is rebuilt from scratch on server start and when a new visitor opens the demo.
const DEMO_PASSWORD = 'password123';
const DEMO_LANDLORD = { email: 'demo-landlord@example.com', name: 'Demo Landlord' };
const DEMO_TENANT = { email: 'demo-tenant@example.com', name: 'Demo Tenant' };

// A visitor who opens the demo within this window keeps the previous visitor's changes,
// so two people exploring at the same time don't wipe each other's work.
const RESET_IF_OLDER_THAN_MS = 30 * 60 * 1000;

const PHOTO = fs.readFileSync(path.join(__dirname, 'ceiling-stain.png'));

const HOUR = 60 * 60 * 1000;
const ago = (hours) => new Date(Date.now() - hours * HOUR);

let lastResetAt = 0;
let resetInFlight = null;

function isDemoEmail(email) {
  return email === DEMO_LANDLORD.email || email === DEMO_TENANT.email;
}

async function resetDemoData(prisma) {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.$transaction(
    async (tx) => {
      const landlord = await tx.user.upsert({
        where: { email: DEMO_LANDLORD.email },
        update: { name: DEMO_LANDLORD.name, role: 'LANDLORD', password, propertyId: null },
        create: { ...DEMO_LANDLORD, role: 'LANDLORD', password },
      });
      const tenant = await tx.user.upsert({
        where: { email: DEMO_TENANT.email },
        update: { name: DEMO_TENANT.name, role: 'TENANT', password, propertyId: null },
        create: { ...DEMO_TENANT, role: 'TENANT', password },
      });

      // Everything on the demo landlord's properties or filed by the demo tenant is demo data,
      // including requests from anyone who joined a demo property before joins were blocked.
      const oldProperties = await tx.property.findMany({ where: { landlordId: landlord.id }, select: { id: true } });
      const oldPropertyIds = oldProperties.map((p) => p.id);
      const oldRequests = await tx.maintenanceRequest.findMany({
        where: { OR: [{ propertyId: { in: oldPropertyIds } }, { tenantId: tenant.id }] },
        select: { id: true, photoId: true },
      });
      const oldRequestIds = oldRequests.map((r) => r.id);
      const oldPhotoIds = oldRequests.map((r) => r.photoId).filter(Boolean);

      await tx.statusHistoryEntry.deleteMany({ where: { requestId: { in: oldRequestIds } } });
      await tx.maintenanceRequest.deleteMany({ where: { id: { in: oldRequestIds } } });
      await tx.photo.deleteMany({ where: { id: { in: oldPhotoIds } } });
      await tx.user.updateMany({ where: { propertyId: { in: oldPropertyIds } }, data: { propertyId: null } });
      await tx.property.deleteMany({ where: { id: { in: oldPropertyIds } } });

      const property = await tx.property.create({
        data: { address: '14 Lake View Road', unitName: 'Flat 3B', joinCode: generateJoinCode(), landlordId: landlord.id },
      });
      await tx.user.update({ where: { id: tenant.id }, data: { propertyId: property.id } });

      const photoId = crypto.randomUUID();
      await tx.photo.create({ data: { id: photoId, mimeType: 'image/png', data: PHOTO } });

      // Each step is [status, changed by, hours ago]; the first step is when the tenant reported it.
      const requests = [
        {
          title: 'No heat in the flat',
          description: 'The radiators have been cold since last night and there is no heat in any room.',
          priority: 'URGENT',
          steps: [['OPEN', tenant, 20], ['IN_PROGRESS', landlord, 18]],
        },
        {
          title: 'Ceiling stain above the bed',
          description: 'A brown water stain appeared on the bedroom ceiling this week and is getting bigger.',
          priority: 'HIGH',
          photoId,
          steps: [['OPEN', tenant, 5]],
        },
        {
          title: 'Bathroom fan is noisy',
          description: 'The extractor fan rattles loudly whenever it runs.',
          priority: 'MEDIUM',
          steps: [['OPEN', tenant, 52]],
        },
        {
          title: 'Loose cabinet handle',
          description: 'The handle on the cabinet under the sink keeps coming off.',
          priority: 'LOW',
          steps: [['OPEN', tenant, 140], ['IN_PROGRESS', landlord, 120], ['RESOLVED', landlord, 96]],
        },
      ];

      for (const r of requests) {
        const [lastStatus] = r.steps[r.steps.length - 1];
        await tx.maintenanceRequest.create({
          data: {
            title: r.title,
            description: r.description,
            priority: r.priority,
            status: lastStatus,
            photoId: r.photoId ?? null,
            photoUrl: r.photoId ? `/api/photos/${r.photoId}` : null,
            createdAt: ago(r.steps[0][2]),
            tenantId: tenant.id,
            propertyId: property.id,
            statusHistory: {
              create: r.steps.map(([status, by, hours]) => ({ status, changedById: by.id, changedAt: ago(hours) })),
            },
          },
        });
      }
    },
    { timeout: 20000 }
  );

  lastResetAt = Date.now();
}

async function resetDemoDataIfStale(prisma) {
  if (Date.now() - lastResetAt < RESET_IF_OLDER_THAN_MS) return;
  resetInFlight ??= resetDemoData(prisma).finally(() => {
    resetInFlight = null;
  });
  await resetInFlight;
}

module.exports = { DEMO_LANDLORD, DEMO_TENANT, isDemoEmail, resetDemoData, resetDemoDataIfStale };
