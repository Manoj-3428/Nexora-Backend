const request = require('supertest');
const { setupTestApp, teardownTestApp, clearDatabase } = require('./helpers/testServer');

let app;

beforeAll(async () => {
  app = await setupTestApp();
});
afterAll(teardownTestApp);
beforeEach(clearDatabase);

const register = (body) => request(app).post('/api/v1/auth/register').send(body);

describe('Auth + Username', () => {
  test('registers a user and auto-generates username from name', async () => {
    const res = await register({ firstName: 'John', lastName: 'Doe', email: 'john@x.com', password: 'secret1', deviceId: 'devA' });
    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe('john_doe');
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  test('resolves username collisions with a numeric suffix', async () => {
    await register({ firstName: 'John', lastName: 'Doe', email: 'a@x.com', password: 'secret1', deviceId: 'd1' });
    const res = await register({ firstName: 'John', lastName: 'Doe', email: 'b@x.com', password: 'secret1', deviceId: 'd2' });
    expect(res.body.data.username).toBe('john_doe1');
  });

  test('rejects a duplicate email', async () => {
    await register({ name: 'Amy Poe', email: 'dup@x.com', password: 'secret1', deviceId: 'd1' });
    const res = await register({ name: 'Bob Poe', email: 'dup@x.com', password: 'secret1', deviceId: 'd2' });
    expect(res.status).toBe(409);
  });

  test('login returns a JWT and hides sensitive fields', async () => {
    await register({ name: 'Kate Ray', email: 'kate@x.com', password: 'secret1', deviceId: 'd1' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'kate@x.com', password: 'secret1', deviceId: 'd1' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  test('login with wrong password -> 401', async () => {
    await register({ name: 'Kate Ray', email: 'kate@x.com', password: 'secret1', deviceId: 'd1' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'kate@x.com', password: 'nope', deviceId: 'd1' });
    expect(res.status).toBe(401);
  });

  test('protected route without token -> 401', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });
});

describe('Username availability + search', () => {
  let token;
  beforeEach(async () => {
    await register({ firstName: 'Alice', lastName: 'Smith', email: 'alice@x.com', password: 'secret1', deviceId: 'dA' });
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'alice@x.com', password: 'secret1', deviceId: 'dA' });
    token = login.body.data.token;
  });

  test('reports taken vs available usernames', async () => {
    const taken = await request(app).get('/api/v1/users/username/check?username=alice_smith').set('Authorization', `Bearer ${token}`);
    expect(taken.body.data.available).toBe(false);
    const free = await request(app).get('/api/v1/users/username/check?username=totally_free').set('Authorization', `Bearer ${token}`);
    expect(free.body.data.available).toBe(true);
  });

  test('search finds users by username prefix and never leaks email', async () => {
    await register({ firstName: 'Bob', lastName: 'Jones', email: 'bob@x.com', password: 'secret1', deviceId: 'dB' });
    const res = await request(app).get('/api/v1/users/search?username=bob').set('Authorization', `Bearer ${token}`);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].username).toBe('bob_jones');
    expect(res.body.data[0]).not.toHaveProperty('email');
  });
});
