const prisma = require('../src/prismaClient');

// Deletes rows in FK-safe order. Used between tests to keep the test DB isolated.
async function resetDb() {
  await prisma.statusHistoryEntry.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.user.updateMany({ data: { propertyId: null } });
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();
}

module.exports = { resetDb, prisma };
