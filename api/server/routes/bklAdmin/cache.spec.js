const express = require('express');
const request = require('supertest');

jest.mock('@librechat/data-schemas', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const { ttlCache, stripFresh } = require('./cache');

function buildApp(opts) {
  const app = express();
  const calls = { n: 0 };
  const router = express.Router();
  router.get('/summary', ttlCache(opts), (req, res) => {
    calls.n += 1;
    res.json({ queries: calls.n, days: req.query.days });
  });
  router.get('/fail', ttlCache(opts), (_req, res) => {
    calls.n += 1;
    res.status(500).json({ error: 'boom' });
  });
  router.post('/summary', ttlCache(opts), (_req, res) => {
    calls.n += 1;
    res.json({ ok: true });
  });
  app.use('/admin-api', router);
  return { app, calls };
}

describe('ttlCache', () => {
  it('같은 쿼리스트링은 TTL 안에서 재계산하지 않고 cached 표시를 붙인다', async () => {
    const { app, calls } = buildApp();
    const r1 = await request(app).get('/admin-api/summary?days=30');
    const r2 = await request(app).get('/admin-api/summary?days=30');
    expect(r1.body).toMatchObject({ queries: 1, cached: false });
    expect(r1.body.cached_at).toBeTruthy();
    expect(r1.headers['x-bkl-cache']).toBe('miss');
    expect(r2.body).toMatchObject({ queries: 1, cached: true, cached_at: r1.body.cached_at });
    expect(r2.headers['x-bkl-cache']).toBe('hit');
    expect(calls.n).toBe(1);
  });

  it('쿼리스트링이 다르면 따로 계산한다', async () => {
    const { app, calls } = buildApp();
    await request(app).get('/admin-api/summary?days=30');
    const r = await request(app).get('/admin-api/summary?days=7');
    expect(r.body).toMatchObject({ queries: 2, days: '7', cached: false });
    expect(calls.n).toBe(2);
  });

  it('fresh=1 은 캐시를 우회하고 같은 키를 갱신한다', async () => {
    const { app, calls } = buildApp();
    await request(app).get('/admin-api/summary?days=30');
    const fresh = await request(app).get('/admin-api/summary?days=30&fresh=1');
    expect(fresh.body).toMatchObject({ queries: 2, cached: false });
    const again = await request(app).get('/admin-api/summary?days=30');
    expect(again.body).toMatchObject({ queries: 2, cached: true });
    expect(calls.n).toBe(2);
  });

  it('TTL 이 지나면 다시 계산한다', async () => {
    const { app, calls } = buildApp({ ttlMs: 50 });
    await request(app).get('/admin-api/summary?days=30');
    await new Promise((r) => setTimeout(r, 70));
    const r = await request(app).get('/admin-api/summary?days=30');
    expect(r.body.cached).toBe(false);
    expect(calls.n).toBe(2);
  });

  it('오류 응답과 GET 이 아닌 요청은 캐시하지 않는다', async () => {
    const { app, calls } = buildApp();
    await request(app).get('/admin-api/fail');
    const r = await request(app).get('/admin-api/fail');
    expect(r.status).toBe(500);
    expect(r.body.cached).toBeUndefined();
    await request(app).post('/admin-api/summary');
    await request(app).post('/admin-api/summary');
    expect(calls.n).toBe(4);
  });

  it('match 로 캐시 대상을 고를 수 있다', async () => {
    const app = express();
    let n = 0;
    app.use(
      '/p',
      ttlCache({ match: (req) => /^\/(summary|daily)(\?|$)/.test(req.url) }),
      (_req, res) => {
        n += 1;
        res.json({ n });
      },
    );
    await request(app).get('/p/summary');
    await request(app).get('/p/summary');
    await request(app).get('/p/models');
    await request(app).get('/p/models');
    expect(n).toBe(3);
  });

  it('stripFresh 는 fresh 만 떼고 나머지 쿼리를 보존한다', () => {
    expect(stripFresh('/a?days=30&fresh=1')).toBe('/a?days=30');
    expect(stripFresh('/a?fresh=1&days=30')).toBe('/a?days=30');
    expect(stripFresh('/a?fresh=1')).toBe('/a');
    expect(stripFresh('/a?days=30')).toBe('/a?days=30');
  });
});
