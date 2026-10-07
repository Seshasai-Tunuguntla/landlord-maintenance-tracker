const request = require('supertest');
const app = require('../src/app');
const { resetDb, prisma, cookieFrom } = require('./dbHelpers');

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
  return { cookie: cookieFrom(res), user: res.body.user };
}

async function setupPropertyWithTenant() {
  const landlord = await registerAndLogin({ name: 'Landlord', role: 'LANDLORD' });
  const propRes = await request(app)
    .post('/api/properties')
    .set('Cookie', landlord.cookie)
    .send({ address: '123 Main St', unitName: 'Unit 1' });
  const joinCode = propRes.body.property.joinCode;

  const tenant = await registerAndLogin({ name: 'Tenant', role: 'TENANT' });
  await request(app)
    .post('/api/properties/join')
    .set('Cookie', tenant.cookie)
    .send({ joinCode });

  return { landlord, tenant, property: propRes.body.property };
}

describe('properties', () => {
  it('lets a landlord create a property and generates a join code', async () => {
    const landlord = await registerAndLogin({ role: 'LANDLORD' });
    const res = await request(app)
      .post('/api/properties')
      .set('Cookie', landlord.cookie)
      .send({ address: '456 Oak Ave' });

    expect(res.status).toBe(201);
    expect(res.body.property.joinCode).toEqual(expect.any(String));
  });

  it('forbids a tenant from creating a property', async () => {
    const tenant = await registerAndLogin({ role: 'TENANT' });
    const res = await request(app)
      .post('/api/properties')
      .set('Cookie', tenant.cookie)
      .send({ address: '456 Oak Ave' });
    expect(res.status).toBe(403);
  });

  it('lets a tenant join via a valid code and rejects an invalid one', async () => {
    const { tenant } = await setupPropertyWithTenant();
    const listRes = await request(app).get('/api/properties').set('Cookie', tenant.cookie);
    expect(listRes.body.properties).toHaveLength(1);

    const other = await registerAndLogin({ role: 'TENANT' });
    const badJoin = await request(app)
      .post('/api/properties/join')
      .set('Cookie', other.cookie)
      .send({ joinCode: 'NOT-A-REAL-CODE' });
    expect(badJoin.status).toBe(404);
  });

  it('accepts a join code typed in lowercase', async () => {
    const landlord = await registerAndLogin({ role: 'LANDLORD' });
    const propRes = await request(app)
      .post('/api/properties')
      .set('Cookie', landlord.cookie)
      .send({ address: '1 Lowercase Rd' });

    const tenant = await registerAndLogin({ role: 'TENANT' });
    const res = await request(app)
      .post('/api/properties/join')
      .set('Cookie', tenant.cookie)
      .send({ joinCode: propRes.body.property.joinCode.toLowerCase() });
    expect(res.status).toBe(200);
  });

  it('stops a tenant after 10 wrong join codes, so codes cannot be guessed', async () => {
    const tenant = await registerAndLogin({ role: 'TENANT' });
    const join = (joinCode) =>
      request(app).post('/api/properties/join').set('Cookie', tenant.cookie).send({ joinCode });

    for (let i = 0; i < 10; i++) {
      expect((await join(`BAD0000${i}`)).status).toBe(404);
    }
    expect((await join('BAD00010')).status).toBe(429);
  });
});

describe('maintenance requests', () => {
  it('lets a tenant submit a request and auto-flags URGENT from keywords, overriding their pick', async () => {
    const { tenant } = await setupPropertyWithTenant();
    const res = await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
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
      .set('Cookie', tenant.cookie)
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
      .set('Cookie', tenant.cookie)
      .field('title', 'Test')
      .field('description', 'Test description');
    expect(res.status).toBe(400);
  });

  it('forbids a landlord from submitting a request', async () => {
    const { landlord } = await setupPropertyWithTenant();
    const res = await request(app)
      .post('/api/requests')
      .set('Cookie', landlord.cookie)
      .field('title', 'Test')
      .field('description', 'Test description');
    expect(res.status).toBe(403);
  });

  it('scopes GET /api/requests to the tenant\'s own requests', async () => {
    const { tenant } = await setupPropertyWithTenant();
    await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');

    const otherTenant = await registerAndLogin({ role: 'TENANT' });

    const tenantRes = await request(app).get('/api/requests').set('Cookie', tenant.cookie);
    expect(tenantRes.body.requests).toHaveLength(1);

    const otherRes = await request(app)
      .get('/api/requests')
      .set('Cookie', otherTenant.cookie);
    expect(otherRes.body.requests).toHaveLength(0);
  });

  it("scopes a landlord's GET /api/requests to their own properties only", async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');

    const otherLandlord = await registerAndLogin({ role: 'LANDLORD' });

    const ownRes = await request(app)
      .get('/api/requests')
      .set('Cookie', landlord.cookie);
    expect(ownRes.body.requests).toHaveLength(1);

    const otherRes = await request(app)
      .get('/api/requests')
      .set('Cookie', otherLandlord.cookie);
    expect(otherRes.body.requests).toHaveLength(0);
  });

  it('lets a landlord update status and appends a changedBy-tracked history entry', async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    const createRes = await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');
    const id = createRes.body.request.id;

    const patchRes = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set('Cookie', landlord.cookie)
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
      .set('Cookie', tenant.cookie)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');
    const id = createRes.body.request.id;

    const res = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set('Cookie', landlord.cookie)
      .send({ status: 'NOT_A_STATUS' });
    expect(res.status).toBe(400);
  });

  it('forbids a tenant from updating status', async () => {
    const { tenant } = await setupPropertyWithTenant();
    const createRes = await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');
    const id = createRes.body.request.id;

    const res = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set('Cookie', tenant.cookie)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(403);
  });

  it("forbids a landlord from updating another landlord's property request", async () => {
    const { tenant } = await setupPropertyWithTenant();
    const createRes = await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');
    const id = createRes.body.request.id;

    const otherLandlord = await registerAndLogin({ role: 'LANDLORD' });
    const res = await request(app)
      .patch(`/api/requests/${id}/status`)
      .set('Cookie', otherLandlord.cookie)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(403);
  });
});

describe('photos', () => {
  // Smallest valid PNG: a 1x1 transparent pixel.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );

  it('stores an uploaded photo in the database and serves the same bytes back', async () => {
    const { tenant } = await setupPropertyWithTenant();
    const createRes = await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', 'Cracked window')
      .field('description', 'See photo')
      .attach('photo', PNG, { filename: 'window.png', contentType: 'image/png' });

    expect(createRes.status).toBe(201);
    const { photoUrl } = createRes.body.request;
    expect(photoUrl).toMatch(/^\/api\/photos\/[0-9a-f-]{36}$/);

    const photoRes = await request(app).get(photoUrl).set('Cookie', tenant.cookie);
    expect(photoRes.status).toBe(200);
    expect(photoRes.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(photoRes.body, PNG)).toBe(0);
  });

  it('shows a photo only to the tenant who filed it and the landlord of that property', async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    const createRes = await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', 'Cracked window')
      .field('description', 'See photo')
      .attach('photo', PNG, { filename: 'window.png', contentType: 'image/png' });
    const { photoUrl } = createRes.body.request;

    const otherTenant = await registerAndLogin({ role: 'TENANT' });
    const otherLandlord = await registerAndLogin({ role: 'LANDLORD' });

    const landlordView = await request(app).get(photoUrl).set('Cookie', landlord.cookie);
    expect(landlordView.status).toBe(200);
    expect(landlordView.headers['cache-control']).toBe('private, no-cache');
    expect((await request(app).get(photoUrl).set('Cookie', otherTenant.cookie)).status).toBe(404);
    expect((await request(app).get(photoUrl).set('Cookie', otherLandlord.cookie)).status).toBe(404);
    expect((await request(app).get(photoUrl)).status).toBe(401);
  });

  it('does not include photo bytes in request lists', async () => {
    const { tenant } = await setupPropertyWithTenant();
    await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', 'Cracked window')
      .field('description', 'See photo')
      .attach('photo', PNG, { filename: 'window.png', contentType: 'image/png' });

    const listRes = await request(app).get('/api/requests').set('Cookie', tenant.cookie);
    expect(listRes.body.requests[0].photoUrl).toBeTruthy();
    expect(listRes.body.requests[0].photo).toBeUndefined();
  });

  it('rejects SVG uploads', async () => {
    const { tenant } = await setupPropertyWithTenant();
    const res = await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', 'Test')
      .field('description', 'Test description')
      .attach('photo', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), {
        filename: 'x.svg',
        contentType: 'image/svg+xml',
      });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown photo id', async () => {
    const { tenant } = await setupPropertyWithTenant();
    const res = await request(app).get('/api/photos/00000000-0000-0000-0000-000000000000').set('Cookie', tenant.cookie);
    expect(res.status).toBe(404);
  });
});

describe('status rules', () => {
  async function createRequest(tenant) {
    const res = await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', 'Leaky faucet')
      .field('description', 'Drips slowly');
    return res.body.request.id;
  }

  function setStatus(landlord, id, status) {
    return request(app)
      .patch(`/api/requests/${id}/status`)
      .set('Cookie', landlord.cookie)
      .send({ status });
  }

  it('rejects setting the status a request already has, without adding history', async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    const id = await createRequest(tenant);

    const res = await setStatus(landlord, id, 'OPEN');
    expect(res.status).toBe(409);
    expect(await prisma.statusHistoryEntry.count({ where: { requestId: id } })).toBe(1);
  });

  it('allows reopening a resolved request and records it in the history', async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    const id = await createRequest(tenant);

    expect((await setStatus(landlord, id, 'RESOLVED')).status).toBe(200);
    const reopened = await setStatus(landlord, id, 'OPEN');
    expect(reopened.status).toBe(200);
    expect(reopened.body.request.statusHistory.map((h) => h.status)).toEqual(['OPEN', 'RESOLVED', 'OPEN']);
  });
});

describe('listing filters and paging', () => {
  async function report(tenant, title, description, priority = 'LOW') {
    const res = await request(app)
      .post('/api/requests')
      .set('Cookie', tenant.cookie)
      .field('title', title)
      .field('description', description)
      .field('priority', priority);
    return res.body.request.id;
  }

  function list(user, query = '') {
    return request(app).get(`/api/requests${query}`).set('Cookie', user.cookie);
  }

  it('filters a landlord list by priority and status', async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    await report(tenant, 'No heat', 'Radiators are cold');
    const lowId = await report(tenant, 'Loose handle', 'Cabinet handle is loose');
    await request(app)
      .patch(`/api/requests/${lowId}/status`)
      .set('Cookie', landlord.cookie)
      .send({ status: 'RESOLVED' });

    const urgent = await list(landlord, '?priority=URGENT');
    expect(urgent.body.requests.map((r) => r.title)).toEqual(['No heat']);

    const resolved = await list(landlord, '?status=RESOLVED');
    expect(resolved.body.requests.map((r) => r.title)).toEqual(['Loose handle']);
  });

  it('pages through results without repeating any', async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    for (const n of [1, 2, 3]) await report(tenant, `Issue ${n}`, 'Details');

    const first = await list(landlord, '?pageSize=2&page=1');
    const second = await list(landlord, '?pageSize=2&page=2');
    expect(first.body.total).toBe(3);
    expect(first.body.requests).toHaveLength(2);
    expect(second.body.requests).toHaveLength(1);
    const ids = [...first.body.requests, ...second.body.requests].map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("keeps the landlord's open and urgent counts independent of filters", async () => {
    const { landlord, tenant } = await setupPropertyWithTenant();
    await report(tenant, 'No heat', 'Radiators are cold');
    await report(tenant, 'Loose handle', 'Cabinet handle is loose');

    const res = await list(landlord, '?status=RESOLVED');
    expect(res.body.requests).toHaveLength(0);
    expect(res.body.summary).toEqual({ open: 2, urgent: 1 });
  });

  it('rejects an unknown filter value', async () => {
    const { landlord } = await setupPropertyWithTenant();
    const res = await list(landlord, '?status=BOGUS');
    expect(res.status).toBe(400);
  });
});
