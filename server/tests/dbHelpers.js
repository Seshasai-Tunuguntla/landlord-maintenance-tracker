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

// The "token=..." pair from a login/register response, ready to send back as a Cookie header.
function cookieFrom(res) {
  const header = (res.headers['set-cookie'] || []).find((c) => c.startsWith('token='));
  return header ? header.split(';')[0] : undefined;
}

module.exports = { resetDb, prisma, cookieFrom };
