const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('~/server/services/Config/app');
jest.mock('~/server/services/bklSso', () => ({ persistBklFields: jest.fn() }));

const { persistBklFields } = require('~/server/services/bklSso');

const TEST_BASE = 'https://nbtest.bkl.co.kr/mentat-api/api/mentat';

const ORG_ROW = {
  sid: 100051,
  groupSid: 330,
  groupName: '기업법무그룹(03)',
  divSid: 328,
  divName: '범자문그룹(01)',
  hqSid: 92,
  hqName: '전문가그룹',
};

/**
 * POST /admin-api/users/:userId/sync-group — 사용자 상세 패널의 단건 그룹 동기화.
 *
 * 일괄 동기화와 달리 BIMS 응답 원문을 돌려주고, 재조회 주기와 무관하게 즉시
 * 부르며, BIMS 쪽 실패도 200 으로 원인을 담아 돌려준다.
 */
describe('POST /users/:userId/sync-group', () => {
  let mongoServer;
  let app;
  let users;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());
    app.use(require('./sessions'));
    users = mongoose.connection.db.collection('users');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await users.deleteMany({});
    process.env.BIMS_ORG_BASE = TEST_BASE;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete process.env.BIMS_ORG_BASE;
  });

  const seedUser = async (fields) => {
    const { insertedId } = await users.insertOne({ email: 'pyh@bkl.co.kr', ...fields });
    return String(insertedId);
  };

  test('BIMS_ORG_BASE 미설정이면 400 이고 호출하지 않는다', async () => {
    delete process.env.BIMS_ORG_BASE;
    const userId = await seedUser({ bkl_sid: 100051 });

    const res = await request(app).post(`/users/${userId}/sync-group`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/BIMS_ORG_BASE/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('잘못된 사용자 ID 는 400', async () => {
    const res = await request(app).post('/users/not-an-id/sync-group').send({});

    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('없는 사용자는 404', async () => {
    const res = await request(app)
      .post(`/users/${new mongoose.Types.ObjectId()}/sync-group`)
      .send({});

    expect(res.status).toBe(404);
  });

  test('BIMS sid 가 없는 사용자는 400 이고 호출하지 않는다', async () => {
    const userId = await seedUser({});

    const res = await request(app).post(`/users/${userId}/sync-group`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sid/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('BIMS 원문과 저장 결과를 돌려주고 해당 사용자에 저장한다', async () => {
    const userId = await seedUser({ bkl_sid: 100051 });
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => [ORG_ROW] });

    const res = await request(app).post(`/users/${userId}/sync-group`).send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      sid: 100051,
      url: `${TEST_BASE}/User/group/100051`,
      status: 200,
      body: [ORG_ROW],
      saved: { bkl_group_sid: 330, bkl_group_name: '기업법무그룹(03)', bkl_hq_name: '전문가그룹' },
      error: null,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(persistBklFields.mock.calls[0][0])).toBe(userId);
  });

  /** 버튼을 눌렀다는 건 지금 다시 보고 싶다는 뜻이다 — 재조회 주기를 따르지 않는다. */
  test('최근에 동기화한 사용자도 즉시 다시 부른다', async () => {
    const userId = await seedUser({
      bkl_sid: 100051,
      bkl_group_sid: 330,
      bkl_org_synced_at: new Date(),
    });
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => [ORG_ROW] });

    await request(app).post(`/users/${userId}/sync-group`).send({});

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('BIMS 가 리다이렉트하면 200 으로 원인을 돌려주고 저장하지 않는다', async () => {
    const userId = await seedUser({ bkl_sid: 100051 });
    global.fetch.mockResolvedValue({ ok: false, status: 307, json: async () => ({}) });

    const res = await request(app).post(`/users/${userId}/sync-group`).send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 307, saved: null });
    expect(res.body.error).toMatch(/리다이렉트/);
    expect(persistBklFields).not.toHaveBeenCalled();
  });
});
