const request = require('supertest');
const app = require('../src/app');
const { resetDb, prisma, cookieFrom } = require('./dbHelpers');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const validUser = {
  name: 'Jamie Landlord',
  email: 'jamie@example.com',
  password: 'password123',
  role: 'LANDLORD',
};

describe('POST /api/auth/register', () => {
  it('registers a new user, sets an httpOnly login cookie, and never returns the token', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: validUser.name, email: validUser.email, role: 'LANDLORD' });
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.token).toBeUndefined();

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validUser, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects a short password', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validUser, password: 'short' });
    expect(res.status).toBe(400);
  });

  it('measures the password limit in bytes, which is what bcrypt actually uses', async () => {
    // 30 emoji are only 60 characters but 120 bytes; bcrypt would silently ignore everything past byte 72.
    const res = await request(app).post('/api/auth/register').send({ ...validUser, password: '🔑'.repeat(30) });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid role', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validUser, role: 'ADMIN' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  it('logs in with correct credentials and sets the login cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(cookieFrom(res)).toEqual(expect.stringMatching(/^token=/));
  });

  it('rejects a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: validUser.password });
    expect(res.status).toBe(401);
  });

  it('locks an account after 10 failed attempts, even for the right password', async () => {
    const email = 'locked-out@example.com';
    await request(app).post('/api/auth/register').send({ ...validUser, email });

    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
    }
    const res = await request(app).post('/api/auth/login').send({ email, password: validUser.password });
    expect(res.status).toBe(429);
  });

  it('does not count successful logins toward the limit', async () => {
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: validUser.password });
      expect(res.status).toBe(200);
    }
  });
});

describe('GET /api/auth/me and logout', () => {
  it('returns the current user for a valid login cookie', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).get('/api/auth/me').set('Cookie', cookieFrom(registerRes));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
  });

  it('rejects a request with no login cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a forged cookie', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('ignores a bearer token: browsers authenticate only with the cookie', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(validUser);
    const token = cookieFrom(registerRes).slice('token='.length);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('clears the login cookie on logout', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'].find((c) => c.startsWith('token='))).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
