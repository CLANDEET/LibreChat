/**
 * BKL BIMS 조직(그룹) 정보 연동.
 *
 * 어드민 [사용자] 메뉴가 그룹을 `class 62` 처럼 원시 코드로 표시하던 것을
 * 실제 그룹명으로 바꾸기 위한 조회 계층이다.
 *
 * 알아둘 점:
 *  - `userClass`(bkl_user_class) 와 무관한 별개 체계다. groupSid 범위가
 *    133~405 로 class 62/63/66 과 겹치지도 않는다.
 *  - base URL 이 기존 `BKL_BIMS_BASE`(/apis/case/mentat) 와 경로 체계가 달라
 *    `BIMS_ORG_BASE` 로 분리한다. 절대 공유하지 않는다.
 *  - 경로 체계가 운영과 테스트에서 다르다 (BIMS 팀 확인, 2026-09-29):
 *        운영   https://nb.bkl.co.kr/apis/mentat
 *        테스트 https://nbtest.bkl.co.kr/mentat-api/api/mentat
 *    운영에 테스트 경로를 쓰면 API 가 아니라 BIMS 웹앱이 받아 307 을 낸다.
 *  - 배치 조회가 없어 사용자 1명당 1콜이다. 그래서 결과를 user document 에
 *    저장해 영구 캐시로 쓰고, 만료됐을 때만 다시 부른다.
 *  - `BIMS_ORG_BASE` 미설정 시 전체 기능이 비활성이다.
 *
 * 환경변수:
 *   BIMS_ORG_BASE         조직 API base (운영: https://nb.bkl.co.kr/apis/mentat)
 *   BIMS_ORG_AUTH_HEADER  정적 인증 헤더 이름 (토큰이 없는 경로용 — 어드민 동기화)
 *   BIMS_ORG_AUTH_VALUE   정적 인증 헤더 값
 *
 * 인증: 로그인 경로는 BIMS 가 방금 발급한 그 사용자의 accessToken 을
 * `Authorization: Bearer` 로 쓴다 (저장하지 않는다). 토큰이 없는 경로는 위
 * 정적 헤더가 있으면 그것을, 없으면 무인증으로 부른다.
 *   BIMS_ORG_TIMEOUT_MS   요청 타임아웃 (기본 8000)
 *   BIMS_ORG_STALE_DAYS   재조회 주기 (기본 30일)
 */
const { logger } = require('@librechat/data-schemas');
const { persistBklFields } = require('~/server/services/bklSso');

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_STALE_DAYS = 30;

const orgBase = () => (process.env.BIMS_ORG_BASE || '').trim().replace(/\/+$/, '');

/** `BIMS_ORG_BASE` 가 설정돼 있을 때만 조직 연동이 동작한다. */
function isOrgApiEnabled() {
  return orgBase().length > 0;
}

function timeoutMs() {
  const value = Number(process.env.BIMS_ORG_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function staleMs() {
  const days = Number(process.env.BIMS_ORG_STALE_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : DEFAULT_STALE_DAYS) * 24 * 3600 * 1000;
}

/**
 * 정적 헤더(환경변수) 위에 사용자 토큰을 얹는다. 정적 헤더도 Authorization 이면
 * 사용자 토큰이 이긴다 — 방금 발급된 본인 토큰이 더 구체적이다.
 */
function authHeaders(accessToken) {
  const name = (process.env.BIMS_ORG_AUTH_HEADER || '').trim();
  const value = process.env.BIMS_ORG_AUTH_VALUE || '';
  return {
    ...(name && value ? { [name]: value } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

/** 어떤 인증으로 불렀는지 — 진단 표시용. 토큰 값은 절대 담지 않는다. */
function authMode(accessToken) {
  if (accessToken) {
    return 'user_token';
  }
  const hasStatic = (process.env.BIMS_ORG_AUTH_HEADER || '').trim() && process.env.BIMS_ORG_AUTH_VALUE;
  return hasStatic ? 'static_header' : 'none';
}

const numOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const strOrNull = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : null;
};

/**
 * 조직 API 응답 → user document 에 저장할 필드.
 *
 * 응답은 배열 1건이 정상이지만 `{ data: [...] }` 로 감싸 오는 변형도 흡수한다.
 * 그룹을 식별할 값이 아무것도 없으면 null 을 돌려 저장을 건너뛰게 한다.
 */
function parseOrgResponse(payload) {
  const items = Array.isArray(payload) ? payload : payload?.data;
  const item = Array.isArray(items) ? items.find((row) => row && typeof row === 'object') : null;
  if (!item) {
    return null;
  }

  const groupSid = numOrNull(item.groupSid ?? item.groupId);
  const groupName = strOrNull(item.groupName);
  if (groupSid == null && groupName == null) {
    return null;
  }

  return {
    bkl_group_sid: groupSid,
    bkl_group_name: groupName,
    bkl_div_sid: numOrNull(item.divSid),
    bkl_div_name: strOrNull(item.divName),
    bkl_hq_sid: numOrNull(item.hqSid),
    bkl_hq_name: strOrNull(item.hqName),
  };
}

function orgUrl(sid) {
  const base = orgBase();
  if (!base) {
    throw new Error('조직 API 미연동 (BIMS_ORG_BASE 미설정)');
  }
  return `${base}/User/group/${encodeURIComponent(sid)}`;
}

/**
 * `GET {base}/User/group/{sid}` 를 부르고 응답을 **판정 전 그대로** 돌려준다.
 * 어드민 단건 동기화가 BIMS 원문을 보여주는 데 쓰고, `fetchUserOrg` 는 이 위에서
 * 판정·파싱만 한다.
 *
 * 리다이렉트를 따라가지 않는다. 운영에서 3xx 가 오면 대개 base URL 이 틀린
 * 것이다 — API 경로가 아니면 BIMS 웹앱(Auth.js)이 요청을 가로채 Azure 로그인
 * (`/login-azure`) 으로 307 을 낸다. 따라가면 HTML 을 JSON 으로 파싱하려다
 * 엉뚱한 오류가 나므로 3xx 는 본문을 읽지 않는다.
 *
 * 2xx 본문 파싱 실패는 그대로 던진다. 삼키면 "그룹 없음" 으로 오인돼
 * 동기화 시각이 찍히고 재조회 주기 동안 다시 시도하지 않게 된다.
 *
 * @param {number|string} sid BIMS 사용자 sid
 * @param {{ accessToken?: string }} [options] accessToken: 그 사용자의 BIMS 토큰
 */
async function requestUserOrg(sid, { accessToken } = {}) {
  const url = orgUrl(sid);
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...authHeaders(accessToken) },
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs()),
  });

  const redirected = res.status >= 300 && res.status < 400;
  let body = null;
  if (res.ok) {
    body = await res.json();
  } else if (!redirected) {
    body = await res.json().catch(() => null);
  }

  return {
    url,
    ok: res.ok,
    status: res.status,
    location: res.headers?.get?.('location') ?? null,
    auth: authMode(accessToken),
    body,
  };
}

/** 조직 정보로 쓸 수 없는 응답이면 원인을 담아 던진다. */
function assertOrgResponse({ ok, status }) {
  if (status >= 300 && status < 400) {
    throw new Error(
      `조직 API 가 리다이렉트를 반환했습니다 (HTTP ${status}) — ` +
        `BIMS_ORG_BASE 경로를 확인하세요 (운영: https://nb.bkl.co.kr/apis/mentat)`,
    );
  }
  if (!ok) {
    throw new Error(`조직 API 응답 오류: HTTP ${status}`);
  }
}

/**
 * 한 사용자의 조직 정보를 읽어 저장할 필드로 돌려준다.
 *
 * @param {number|string} sid BIMS 사용자 sid
 * @param {{ accessToken?: string }} [options]
 * @returns {Promise<Record<string, unknown>|null>} 저장할 필드 또는 null
 */
async function fetchUserOrg(sid, options) {
  const response = await requestUserOrg(sid, options);
  assertOrgResponse(response);
  return parseOrgResponse(response.body);
}

/**
 * 재조회가 필요한지 판단한다. sid 가 없으면 조회 자체가 불가능하다.
 * @param {Record<string, unknown>|null} user
 */
function needsOrgSync(user) {
  if (!user || !user.bkl_sid) {
    return false;
  }
  if (user.bkl_group_sid == null && user.bkl_group_name == null) {
    return true;
  }
  const syncedAt = user.bkl_org_synced_at ? new Date(user.bkl_org_synced_at).getTime() : 0;
  return !Number.isFinite(syncedAt) || syncedAt <= 0 || Date.now() - syncedAt > staleMs();
}

/**
 * `needsOrgSync` 의 Mongo 쿼리 버전 — 일괄 동기화 대상을 고른다.
 *
 * 성공 시(그룹이 비어 있어도) `bkl_org_synced_at` 을 갱신하므로 이 타임스탬프
 * 하나로 "한 번도 안 함"과 "오래됨"을 모두 판별할 수 있다. 실패한 사용자는
 * 타임스탬프가 남지 않아 다음 실행에서 자연히 다시 대상이 된다.
 */
function orgSyncFilter() {
  return {
    bkl_sid: { $type: 'number' },
    $or: [
      { bkl_org_synced_at: { $exists: false } },
      { bkl_org_synced_at: { $lt: new Date(Date.now() - staleMs()) } },
    ],
  };
}

/**
 * 조직 정보를 조회해 user document 에 저장한다.
 *
 * 조회는 됐지만 그룹이 비어 있는 경우에도 `bkl_org_synced_at` 은 갱신한다.
 * 그렇지 않으면 그룹이 없는 사용자를 매번 다시 조회하게 된다.
 *
 * @returns {Promise<boolean>} 그룹 정보를 저장했으면 true
 */
async function syncUserOrg(userId, sid, options) {
  const fields = await fetchUserOrg(sid, options);
  await saveUserOrg(userId, fields);
  return fields != null;
}

function saveUserOrg(userId, fields) {
  return persistBklFields(userId, { ...(fields || {}), bkl_org_synced_at: new Date() });
}

/**
 * 어드민 단건 동기화 — BIMS 원문과 저장 결과를 함께 돌려준다.
 *
 * `syncUserOrg` 와 달리 실패해도 던지지 않고 원인을 담아 돌려준다. 이 경로의
 * 목적이 "이 사람은 왜 그룹이 안 잡히나" 를 원문으로 보는 것이라, 307 / 401 /
 * 타임아웃도 화면에 그대로 보여야 한다. 저장 규칙은 `syncUserOrg` 와 같고,
 * 재조회 주기와 무관하게 즉시 부른다.
 *
 * @returns {Promise<{url: string, ok: boolean, status: number|null, location: string|null,
 *   auth: string, body: unknown, saved: Record<string, unknown>|null, error: string|null}>}
 */
async function inspectAndSyncUserOrg(userId, sid) {
  let response;
  try {
    response = await requestUserOrg(sid);
  } catch (err) {
    return {
      url: orgUrl(sid),
      ok: false,
      status: null,
      location: null,
      auth: authMode(),
      body: null,
      saved: null,
      error: err.message,
    };
  }

  try {
    assertOrgResponse(response);
  } catch (err) {
    return { ...response, saved: null, error: err.message };
  }

  const fields = parseOrgResponse(response.body);
  await saveUserOrg(userId, fields);
  return { ...response, saved: fields, error: null };
}

/**
 * 로그인 경로에서 쓰는 비차단 갱신 — 비밀번호 로그인과 OIDC 로그인 모두.
 *
 * 로그인 응답을 지연시키지 않는 것이 핵심이다. 실패는 로그만 남기고 삼킨다 —
 * 조직 정보가 없다고 로그인을 막을 이유가 없다.
 *
 * `accessToken` 은 로그인 중 BIMS 가 방금 발급한 그 사용자의 토큰이다. 그 자리
 * 에서 한 번 쓰고 버린다 — 저장하지 않으니 만료(30일)를 관리할 필요도 없다.
 *
 * @param {Record<string, unknown>|null} user
 * @param {{ accessToken?: string }} [options]
 */
function refreshUserOrgInBackground(user, options) {
  if (!isOrgApiEnabled() || !needsOrgSync(user)) {
    return;
  }
  setImmediate(() => {
    syncUserOrg(user._id, user.bkl_sid, options).catch((err) => {
      logger.warn(`[BKL Org] 조직 정보 갱신 실패 (sid=${user.bkl_sid}): ${err.message}`);
    });
  });
}

module.exports = {
  isOrgApiEnabled,
  parseOrgResponse,
  fetchUserOrg,
  needsOrgSync,
  orgSyncFilter,
  syncUserOrg,
  inspectAndSyncUserOrg,
  refreshUserOrgInBackground,
};
