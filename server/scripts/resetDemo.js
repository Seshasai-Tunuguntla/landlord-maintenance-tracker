require('dotenv').config();
const prisma = require('../src/prismaClient');
const { resetDemoData } = require('../src/demo/demo');

resetDemoData(prisma)
  .then(() => console.log('Demo data reset'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
