const { logger } = require('@librechat/data-schemas');

/**
 * 어드민 통계 GET 응답의 메모리 TTL 캐시.
 *
 * bkl_query_logs 는 append-only 라 몇 분 지연은 문제가 안 되고, 어드민은 여러 명이
 * 같은 기간(기본 30일)을 반복해서 연다. 첫 사람 이후에는 같은 쿼리스트링이면 Mongo
 * 집계를 다시 돌리지 않는다. `?fresh=1` 이면 우회한다 (어드민 새로고침 버튼).
 *
 * 응답 JSON 에 `cached` / `cached_at` 을 덧붙여 화면에서 "N분 전 기준" 을 보여줄 수
 * 있게 한다. 200 이 아닌 응답은 캐시하지 않는다. 1초 넘게 걸린 집계는 경고 로그.
 */
const DEFAULT_TTL_MS = Math.max(
  0,
  parseInt(process.env.BKL_ADMIN_CACHE_TTL_MS, 10) || 5 * 60 * 1000,
);
const MAX_ENTRIES = 500;
const SLOW_MS = 1000;

function stripFresh(url) {
  return url
    .replace(/([?&])fresh=1(&|$)/, (_m, lead, tail) => (tail ? lead : ''))
    .replace(/[?&]$/, '');
}

/**
 * @param {{ ttlMs?: number, match?: (req) => boolean }} [opts]
 *   match — 캐시 대상 판정 (기본: 모든 GET). 프록시처럼 한 라우트에 여러 경로가
 *   섞여 있을 때 집계 경로만 고르는 용도.
 */
function ttlCache(opts = {}) {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const match = opts.match || (() => true);
  const store = new Map();

  function prune(now) {
    if (store.size < MAX_ENTRIES) {
      return;
    }
    for (const [k, v] of store) {
      if (now - v.ts >= ttlMs) {
        store.delete(k);
      }
    }
    if (store.size >= MAX_ENTRIES) {
      store.clear();
    }
  }

  return function cacheMiddleware(req, res, next) {
    if (req.method !== 'GET' || ttlMs <= 0 || !match(req)) {
      return next();
    }
    const fresh = req.query.fresh === '1';
    const key = stripFresh(req.originalUrl || req.url);
    const now = Date.now();
    const hit = store.get(key);
    if (hit && !fresh && now - hit.ts < ttlMs) {
      res.set('X-Bkl-Cache', 'hit');
      return res.json({ ...hit.body, cached: true, cached_at: new Date(hit.ts).toISOString() });
    }

    const t0 = now;
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const elapsed = Date.now() - t0;
      if (elapsed >= SLOW_MS) {
        logger.warn(`[bklAdmin/cache] slow ${key} ${elapsed}ms`);
      }
      if (res.statusCode === 200 && body && typeof body === 'object' && !Array.isArray(body)) {
        prune(Date.now());
        const ts = Date.now();
        store.set(key, { ts, body });
        res.set('X-Bkl-Cache', 'miss');
        return originalJson({
          ...body,
          cached: false,
          cached_at: new Date(ts).toISOString(),
          elapsed_ms: elapsed,
        });
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { ttlCache, stripFresh };
