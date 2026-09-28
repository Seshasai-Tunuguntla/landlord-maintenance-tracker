const request = require('supertest');
const app = require('../src/app');
const { resetDb, prisma } = require('./dbHelpers');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAndLogin(overrides = {}) {
  const payload = {
    name: 'User',
    email: `user-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    role: 'TENANT',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  return { token: res.body.token, user: res.body.user };
}

async function setupPropertyWithTenant() {
  const landlord = await registerAndLogin({ name: 'Landlord', role: 'LANDLORD' });
  const propRes = await request(app)
    .post('/api/properties')
    .set('Authorization', `Bearer ${landlord.token}`)
    .send({ address: '123 Main St', unitName: 'Unit 1' });
  const joinCode = propRes.body.property.joinCode;

  const tenant = await registerAndLogin({ name: 'Tenant', role: 'TENANT' });
  await request(app)
    .post('/api/properties/join')
    .set('Authorization', `Bearer ${tenant.token}`)
    .send({ joinCode });

  return { landlord, tenant, property: propRes.body.property };
}

describe('properties', () => {
  it('lets a landlord create a property and generates a join code', async () => {
    const landlord = await registerAndLogin({ role: 'LANDLORD' });
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlord.token}`)
      .send({ address: '456 Oak Ave' });

    expect(res.status).toBe(201);
    expect(res.body.property.joinCode).toEqual(expect.any(String));
  });

  it('forbids a tenant from creating a property', async () => {
    const tenant = await registerAndLogin({ role: 'TENANT' });
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({ address: '456 Oak Ave' });
    expect(res.status).toBe(403);
  });

  it('lets a tenant join via a valid code and rejects an invalid one', async () => {
    const { tenant } = await setupPropertyWithTenant();
    const listRes = await request(app).get('/api/properties').set('Authorization', `Bearer ${tenant.token}`);
    expect(listRes.body.properties).toHaveLength(1);

    const other = await registerAndLogin({ role: 'TENANT' });
    const badJoin = await request(app)
      .post('/api/properties/join')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ joinCode: 'NOT-A-REAL-CODE' });
    expect(badJoin.status).toBe(404);
  });
});

describe('maintenance requests', () => {
  it('lets a tenant submit a request and auto-flags URGENT from keywords, overriding their pick', async () => {
    const { tenant } = await setupPropertyWithTenant();
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tenant.token}`)
      .field('title', 'No heat')
      .field('description', 'There is no heat and I smell gas near the furnace')
      .field('priority', 'LOW');

    expect(res.status).toBe(201);
    expect(res.body.request.priority).toBe('URGENT');
    expect(res.body.request.status).toBe('OPEN');
    expect(res.body.request.statusHistory[0]).toMatchObject({ status: 'OPEN', changedById: tenant.user.id });
  });

  it('honors the tenant-selected priority when no urgent keywords are present', async () => {
    const { tenant } = await setupPropertyWithTenant();
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tenant.token}`)
      .field('title', 'Squeaky door')
      .field('description', 'Hinge needs oil')
      .field('priority', 'HIGH');

    expect(res.status).toBe(201);
    expect(res.body.request.priority).toBe('HIGH');
  });

  it('blocks a tenant with no property from submitting a request', async () => {
    const tenant = await registerAndLogin({ role: 'TENANT' });
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tenant.token}`)
      .field('title', 'Test')
      .field('description', 'Test description');
    expect(res.status).toBe(400);
  });

  it('forbids a landlord from submitting a request', async () => {
    const { landlord } = await setupPropertyWithTenant();
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${landlord.token}`)
      .field('title', 'Test')
      .field('description', 'Test description');
    expect(res.status).toBe(403);
  });

  it('scopes GET /api/requests to the tenant\'s own requests', async () => {
    const { tenant } = await setupPropertyWithTenant();
    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tenant.token}`)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');

    const otherTenant = await registerAndLogin({ role: 'TENANT' });

    const tenantRes = await request(app).get('/api/requests').set('Authorization', `Bearer ${tenant.token}`);
    expect(tenantRes.body.requests).toHaveLength(1);

    const otherRes = await request(app)
      .get('/api/requests')
      .set('Authorization', `Bearer ${otherTenant.token}`);
    expect(otherRes.body.requests).toHaveLength(0);
  });

  it("scopes a landlord's GET /api/requests to their own properties only", async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tenant.token}`)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');

    const otherLandlord = await registerAndLogin({ role: 'LANDLORD' });

    const ownRes = await request(app)
      .get('/api/requests')
      .set('Authorization', `Bearer ${landlord.token}`);
    expect(ownRes.body.requests).toHaveLength(1);

    const otherRes = await request(app)
      .get('/api/requests')
      .set('Authorization', `Bearer ${otherLandlord.token}`);
    expect(otherRes.body.requests).toHaveLength(0);
  });

  it('lets a landlord update status and appends a changedBy-tracked history entry', async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    const createRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tenant.token}`)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');
    const id = createRes.body.request.id;

    const patchRes = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set('Authorization', `Bearer ${landlord.token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.request.status).toBe('IN_PROGRESS');
    expect(patchRes.body.request.statusHistory).toHaveLength(2);
    expect(patchRes.body.request.statusHistory[1]).toMatchObject({
      status: 'IN_PROGRESS',
      changedById: landlord.user.id,
    });
  });

  it('rejects an invalid status value', async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    const createRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tenant.token}`)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');
    const id = createRes.body.request.id;

    const res = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set('Authorization', `Bearer ${landlord.token}`)
      .send({ status: 'NOT_A_STATUS' });
    expect(res.status).toBe(400);
  });

  it('forbids a tenant from updating status', async () => {
    const { tenant } = await setupPropertyWithTenant();
    const createRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tenant.token}`)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');
    const id = createRes.body.request.id;

    const res = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set('Authorization', `Bearer ${tenant.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(403);
  });

  it("forbids a landlord from updating another landlord's property request", async () => {
    const { tenant } = await setupPropertyWithTenant();
    const createRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tenant.token}`)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');
    const id = createRes.body.request.id;

    const otherLandlord = await registerAndLogin({ role: 'LANDLORD' });
    const res = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set('Authorization', `Bearer ${otherLandlord.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(403);
  });
});
