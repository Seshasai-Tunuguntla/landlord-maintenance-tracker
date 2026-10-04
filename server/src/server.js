require('dotenv').config();
const app = require('./app');
const prisma = require('./prismaClient');
const { resetDemoData } = require('./demo/demo');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  resetDemoData(prisma)
    .then(() => console.log('Demo data reset'))
    .catch((err) => console.error('Demo data reset failed:', err));
});
