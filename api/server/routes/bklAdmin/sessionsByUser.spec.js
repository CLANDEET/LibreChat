const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('~/server/services/Config/app');
jest.mock('~/server/services/bklSso', () => ({ persistBklFields: jest.fn() }));

const DAY = 24 * 3600 * 1000;
const USER = 'user-a';

/**
 * GET /sessions/by-user — 세션 목록은 **기간 내 질의가 있었던 대화** 기준이다 (2026-11-05).
 *
 * 이전에는 대화 생성일(conversations.createdAt)로 걸러서, 60일 전 만든 대화에서
 * 최근 30일에 친 질의가 목록에 안 나왔다. 집행부 월간 보고의 "채팅 횟수" 는
 * 사용자 표·채팅 내역과 같은 bkl_query_logs 기준이어야 숫자가 맞는다.
 */
describe('GET /sessions/by-user', () => {
  let mongoServer;
  let app;
  let db;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    db = mongoose.connection.db;

    app = express();
    app.use(express.json());
    app.use(require('./sessions'));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await db.collection('conversations').deleteMany({});
    await db.collection('bkl_query_logs').deleteMany({});
  });

  const seedConvo = async ({ createdDaysAgo, title = '대화', deleted = false }) => {
    const conversationId = uuidv4();
    await db.collection('conversations').insertOne({
      conversationId,
      user: USER,
      title,
      createdAt: new Date(Date.now() - createdDaysAgo * DAY),
      updatedAt: new Date(),
      ...(deleted ? { bklDeletedAt: new Date() } : {}),
    });
    return conversationId;
  };

  const seedQuery = (
    conversationId,
    daysAgo,
    { kind = 'query', text = '질문', user = USER } = {},
  ) =>
    db.collection('bkl_query_logs').insertOne({
      messageId: uuidv4(),
      conversationId,
      user,
      kind,
      textPreview: text,
      createdAt: new Date(Date.now() - daysAgo * DAY),
    });

  test('60일 전 만든 대화라도 최근 30일에 질의가 있으면 나오고, 기간 내 질의 수를 센다', async () => {
    const old = await seedConvo({ createdDaysAgo: 60, title: '오래된 대화' });
    await seedQuery(old, 59, { text: '옛 질문' }); // 기간 밖
    await seedQuery(old, 10, { text: '최근 질문 1' });
    await seedQuery(old, 3, { text: '최근 질문 2' });
    await seedQuery(old, 2, { kind: 'query_enhance', text: '강화' });

    const res = await request(app).get('/sessions/by-user').query({ user_id: USER, days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const row = res.body.data[0];
    expect(row.conversation_id).toBe(old);
    expect(row.title).toBe('오래된 대화');
    expect(row.queries).toBe(2); // 기간 내 query 만
    expect(row.enhances).toBe(1);
    expect(row.total_queries).toBe(3); // 전 기간 query
    expect(row.first_query).toBe('최근 질문 1'); // 기간 내 첫 질의
    expect(new Date(row.created_at).getTime()).toBeLessThan(Date.now() - 59 * DAY);
    expect(row.deleted_at).toBeNull();
    expect(row.missing).toBe(false);
  });

  test('기간 내 질의가 없는 대화는 최근에 만들었어도 나오지 않는다', async () => {
    const fresh = await seedConvo({ createdDaysAgo: 1, title: '빈 대화' });
    const older = await seedConvo({ createdDaysAgo: 5 });
    await seedQuery(older, 4);

    const res = await request(app).get('/sessions/by-user').query({ user_id: USER, days: 30 });

    const ids = res.body.data.map((r) => r.conversation_id);
    expect(ids).toEqual([older]);
    expect(ids).not.toContain(fresh);
  });

  test('삭제된 대화도 로그가 있으면 포함한다 (소프트·하드 삭제 표시)', async () => {
    const soft = await seedConvo({ createdDaysAgo: 20, title: '지운 대화', deleted: true });
    await seedQuery(soft, 15);
    const hard = uuidv4(); // conversations 에 없음
    await seedQuery(hard, 12);

    const res = await request(app).get('/sessions/by-user').query({ user_id: USER, days: 30 });

    const byId = new Map(res.body.data.map((r) => [r.conversation_id, r]));
    expect(byId.get(soft).deleted_at).not.toBeNull();
    expect(byId.get(soft).title).toBe('지운 대화');
    expect(byId.get(hard).missing).toBe(true);
    expect(byId.get(hard).title).toBe('(삭제된 대화)');
  });

  test('세션별 queries 합 = 사용자 표(usage/by-user)의 질의 수 — 다른 사용자 로그는 제외', async () => {
    const a1 = await seedConvo({ createdDaysAgo: 40 });
    const a2 = await seedConvo({ createdDaysAgo: 2 });
    await seedQuery(a1, 20);
    await seedQuery(a1, 19);
    await seedQuery(a2, 1);
    await seedQuery(a2, 1, { user: 'user-b' });

    const res = await request(app).get('/sessions/by-user').query({ user_id: USER, days: 30 });

    const sum = res.body.data.reduce((acc, r) => acc + r.queries, 0);
    expect(sum).toBe(3);
    // 최근 활동 순
    expect(res.body.data.map((r) => r.conversation_id)).toEqual([a2, a1]);
  });

  test('user_id 누락 시 400', async () => {
    const res = await request(app).get('/sessions/by-user');
    expect(res.status).toBe(400);
  });
});
