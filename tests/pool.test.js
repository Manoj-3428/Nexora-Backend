const request = require('supertest');
const { setupTestApp, teardownTestApp, clearDatabase } = require('./helpers/testServer');

let app;

beforeAll(async () => {
  app = await setupTestApp();
});
afterAll(teardownTestApp);
beforeEach(clearDatabase);

// --- helpers ---
const createUser = async (firstName, lastName, email, deviceId) => {
  await request(app).post('/api/v1/auth/register').send({ firstName, lastName, email, password: 'secret1', deviceId });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'secret1', deviceId });
  return { token: login.body.data.token, userId: login.body.data.user.userId };
};
const auth = (t) => ['Authorization', `Bearer ${t}`];

const createPrivatePool = (token, overrides = {}) =>
  request(app)
    .post('/api/v1/pools')
    .set(...auth(token))
    .send({
      poolName: 'Private Pool',
      hostDeviceId: 'devA',
      isPublic: false,
      passwordProtected: true,
      password: 'poolpass',
      maxParticipants: 3,
      latitude: 12.9716,
      longitude: 77.5946,
      durationMs: 30 * 60 * 1000,
      ...overrides,
    });

describe('Pool creation', () => {
  test('creates a private pool, hides password hash, issues a pool code', async () => {
    const owner = await createUser('John', 'Doe', 'john@x.com', 'devA');
    const res = await createPrivatePool(owner.token);
    expect(res.status).toBe(201);
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect(res.body.data.poolCode).toHaveLength(8);
    expect(res.body.data.type).toBe('PRIVATE');
    expect(res.body.data.currentParticipantCount).toBe(1);
  });

  test('rejects an invalid location', async () => {
    const owner = await createUser('John', 'Doe', 'john@x.com', 'devA');
    const res = await createPrivatePool(owner.token, { latitude: 999, longitude: 77 });
    expect(res.status).toBe(400);
  });

  test('rejects a lifetime that is too short', async () => {
    const owner = await createUser('John', 'Doe', 'john@x.com', 'devA');
    const res = await createPrivatePool(owner.token, { durationMs: 1000 });
    expect(res.status).toBe(400);
  });
});

describe('Geospatial discovery', () => {
  test('finds nearby active pools with distance + proximity, hides exact coords', async () => {
    const owner = await createUser('John', 'Doe', 'john@x.com', 'devA');
    await createPrivatePool(owner.token);
    const seeker = await createUser('Ann', 'Lee', 'ann@x.com', 'devZ');
    const res = await request(app)
      .get('/api/v1/pools/discover?latitude=12.9718&longitude=77.5949&radius=5000')
      .set(...auth(seeker.token));
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].distanceMeters).toBeLessThan(500);
    expect(res.body.data[0].proximity).toBeTruthy();
    expect(res.body.data[0]).not.toHaveProperty('location');
  });

  test('excludes pools outside the radius', async () => {
    const owner = await createUser('John', 'Doe', 'john@x.com', 'devA');
    await createPrivatePool(owner.token);
    const seeker = await createUser('Ann', 'Lee', 'ann@x.com', 'devZ');
    const res = await request(app)
      .get('/api/v1/pools/discover?latitude=40&longitude=-70&radius=5000')
      .set(...auth(seeker.token));
    expect(res.body.data.length).toBe(0);
  });
});

describe('Join access control', () => {
  let owner;
  let alice;
  let poolId;
  beforeEach(async () => {
    owner = await createUser('John', 'Doe', 'john@x.com', 'devA');
    alice = await createUser('Alice', 'Smith', 'alice@x.com', 'devC');
    const pool = await createPrivatePool(owner.token);
    poolId = pool.body.data.poolId;
  });

  test('requires a password for a private pool', async () => {
    const res = await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(alice.token)).send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('PASSWORD_REQUIRED');
  });

  test('rejects a wrong password', async () => {
    const res = await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(alice.token)).send({ password: 'wrong' });
    expect(res.body.code).toBe('INVALID_PASSWORD');
  });

  test('accepts the correct password and increments participants', async () => {
    const res = await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(alice.token)).send({ password: 'poolpass' });
    expect(res.status).toBe(200);
    expect(res.body.data.currentParticipantCount).toBe(2);
  });

  test('rejects a duplicate join', async () => {
    await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(alice.token)).send({ password: 'poolpass' });
    const res = await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(alice.token)).send({ password: 'poolpass' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_JOINED');
  });

  test('authorized user joins without a password', async () => {
    await request(app).post(`/api/v1/pools/${poolId}/authorized-users`).set(...auth(owner.token)).send({ username: 'alice_smith' });
    const res = await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(alice.token)).send({});
    expect(res.status).toBe(200);
  });

  test('enforces the participant capacity (POOL_FULL)', async () => {
    // maxParticipants = 3, owner already occupies 1 slot -> 2 more allowed.
    const u2 = await createUser('U2', 'X', 'u2@x.com', 'd2');
    const u3 = await createUser('U3', 'X', 'u3@x.com', 'd3');
    const u4 = await createUser('U4', 'X', 'u4@x.com', 'd4');
    await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(u2.token)).send({ password: 'poolpass' });
    await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(u3.token)).send({ password: 'poolpass' });
    const res = await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(u4.token)).send({ password: 'poolpass' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('POOL_FULL');
  });
});

describe('Authorization, participants & IDOR', () => {
  let owner;
  let alice;
  let poolId;
  beforeEach(async () => {
    owner = await createUser('John', 'Doe', 'john@x.com', 'devA');
    alice = await createUser('Alice', 'Smith', 'alice@x.com', 'devC');
    const pool = await createPrivatePool(owner.token);
    poolId = pool.body.data.poolId;
    await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(alice.token)).send({ password: 'poolpass' });
  });

  test('non-owner cannot update the pool (IDOR)', async () => {
    const res = await request(app).patch(`/api/v1/pools/${poolId}`).set(...auth(alice.token)).send({ poolName: 'Hacked' });
    expect(res.status).toBe(403);
  });

  test('owner lists and removes a participant', async () => {
    let res = await request(app).get(`/api/v1/pools/${poolId}/participants`).set(...auth(owner.token));
    expect(res.body.data.items.length).toBe(2);
    res = await request(app).delete(`/api/v1/pools/${poolId}/participants/${alice.userId}`).set(...auth(owner.token));
    expect(res.status).toBe(200);
    res = await request(app).get(`/api/v1/pools/${poolId}/participants`).set(...auth(owner.token));
    expect(res.body.data.items.length).toBe(1);
  });

  test('non-owner cannot list authorized users', async () => {
    const res = await request(app).get(`/api/v1/pools/${poolId}/authorized-users`).set(...auth(alice.token));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Files (metadata)', () => {
  test('owner adds and lists file metadata', async () => {
    const owner = await createUser('John', 'Doe', 'john@x.com', 'devA');
    const pool = await createPrivatePool(owner.token);
    const poolId = pool.body.data.poolId;
    const add = await request(app)
      .post(`/api/v1/pools/${poolId}/files`)
      .set(...auth(owner.token))
      .send({ itemName: 'clip.mp4', itemType: 'VIDEO', mimeType: 'video/mp4', size: 1048576, streamable: true });
    expect(add.status).toBe(201);
    const list = await request(app).get(`/api/v1/pools/${poolId}/files`).set(...auth(owner.token));
    expect(list.body.data.length).toBe(1);
  });
});

describe('Lifecycle: end, history, activity', () => {
  test('end is idempotent and blocks new joins; history + activity populate', async () => {
    const owner = await createUser('John', 'Doe', 'john@x.com', 'devA');
    const alice = await createUser('Alice', 'Smith', 'alice@x.com', 'devC');
    const pool = await createPrivatePool(owner.token);
    const poolId = pool.body.data.poolId;

    let res = await request(app).post(`/api/v1/pools/${poolId}/end`).set(...auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.data.poolStatus).toBe('ENDED');

    res = await request(app).post(`/api/v1/pools/${poolId}/end`).set(...auth(owner.token));
    expect(res.status).toBe(200); // idempotent

    res = await request(app).post(`/api/v1/pools/${poolId}/join`).set(...auth(alice.token)).send({ password: 'poolpass' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('POOL_ENDED');

    res = await request(app).get('/api/v1/pools/discover?latitude=12.9716&longitude=77.5946&radius=5000').set(...auth(alice.token));
    expect(res.body.data.length).toBe(0); // ended pool excluded

    res = await request(app).get('/api/v1/pools/history?type=created').set(...auth(owner.token));
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].isOwner).toBe(true);

    res = await request(app).get('/api/v1/activity').set(...auth(owner.token));
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });
});
