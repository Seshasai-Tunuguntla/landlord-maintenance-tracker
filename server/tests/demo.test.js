const request = require('supertest');
const app = require('../src/app');
const { resetDb, prisma } = require('./dbHelpers');
const { DEMO_LANDLORD, DEMO_TENANT, resetDemoData } = require('../src/demo/demo');

beforeEach(async () => {
  await resetDb();
  await resetDemoData(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function login(email, password = 'password123') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

describe('demo data', () => {
  it('creates the demo landlord, tenant, property and sample requests', async () => {
    const tenant = await prisma.user.findUnique({ where: { email: DEMO_TENANT.email } });
    expect(tenant.propertyId).not.toBeNull();

    const requests = await prisma.maintenanceRequest.findMany({ orderBy: { id: 'asc' } });
    expect(requests.map((r) => [r.priority, r.status])).toEqual([
      ['URGENT', 'IN_PROGRESS'],
      ['HIGH', 'OPEN'],
      ['MEDIUM', 'OPEN'],
      ['LOW', 'RESOLVED'],
    ]);
    expect(await prisma.photo.count()).toBe(1);
  });

  it('undoes visitor changes when reset', async () => {
    const landlordToken = await login(DEMO_LANDLORD.email);
    const tenantToken = await login(DEMO_TENANT.email);

    const urgent = await prisma.maintenanceRequest.findFirst({ where: { priority: 'URGENT' } });
    await request(app)
      .patch(`/api/requests/${urgent.id}/status`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ status: 'RESOLVED' });
    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tenantToken}`)
      .field('title', 'Junk')
      .field('description', 'Visitor test');

    await resetDemoData(prisma);

    expect(await prisma.maintenanceRequest.count()).toBe(4);
    expect(await prisma.maintenanceRequest.count({ where: { title: 'Junk' } })).toBe(0);
    const urgentAgain = await prisma.maintenanceRequest.findFirst({ where: { priority: 'URGENT' } });
    expect(urgentAgain.status).toBe('IN_PROGRESS');
  });

  it('leaves real users and their data alone', async () => {
    const landlord = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Real Landlord', email: 'real-landlord@example.com', password: 'password123', role: 'LANDLORD' });
    await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlord.body.token}`)
      .send({ address: '1 Real Street' });

    await resetDemoData(prisma);

    expect(await prisma.user.count({ where: { email: 'real-landlord@example.com' } })).toBe(1);
    expect(await prisma.property.count({ where: { address: '1 Real Street' } })).toBe(1);
  });

  it('keeps the demo password working after a reset', async () => {
    expect(await login(DEMO_LANDLORD.email)).toEqual(expect.any(String));
    expect(await login(DEMO_TENANT.email)).toEqual(expect.any(String));
  });

  it("stops the demo tenant from joining someone else's property", async () => {
    const landlord = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Real Landlord', email: 'real-landlord@example.com', password: 'password123', role: 'LANDLORD' });
    const property = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlord.body.token}`)
      .send({ address: '1 Real Street' });

    const res = await request(app)
      .post('/api/properties/join')
      .set('Authorization', `Bearer ${await login(DEMO_TENANT.email)}`)
      .send({ joinCode: property.body.property.joinCode });
    expect(res.status).toBe(403);
  });

  it('stops other tenants from joining the demo property', async () => {
    const tenant = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Real Tenant', email: 'real-tenant@example.com', password: 'password123', role: 'TENANT' });
    const demoProperty = await prisma.property.findFirst();

    const res = await request(app)
      .post('/api/properties/join')
      .set('Authorization', `Bearer ${tenant.body.token}`)
      .send({ joinCode: demoProperty.joinCode });
    expect(res.status).toBe(403);
  });
});
