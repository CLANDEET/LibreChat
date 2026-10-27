const mongoose = require('mongoose');
const { linkBimsIdentity } = require('./bklSso');

/** BIMS `/apis/identity/auth/login` 실측 응답 형태 (2026-10-13, PYH). */
const BIMS_LOGIN_OK = {
  accessToken: 'bims-access-token',
  refreshToken: 'bims-refresh-token',
  sid: 100051,
  userId: 'PYH',
  userNm: '허보열',
  userClass: 66,
  roles: [950, 983],
  message: null,
  errorCode: null,
};

/**
 * linkBimsIdentity 는 BIMS 가 방금 발급한 토큰을 호출자에게 돌려준다 (로그인 직후
 * 조직 조회에 한 번 쓰고 버리기 위해서). 핵심은 **돌려주기만 한다**는 것이다 —
 * user 객체나 user 문서에 실리면 세션·로그·DB 로 퍼진다.
 */
describe('linkBimsIdentity', () => {
  let existingDoc;
  let persisted;

  beforeEach(() => {
    existingDoc = null;
    persisted = [];
    mongoose.models.User = {
      findById: () => ({ lean: async () => existingDoc }),
      findByIdAndUpdate: (_id, update) => {
        persisted.push(update);
        return { lean: async () => ({}) };
      },
    };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete mongoose.models.User;
  });

  test('성공하면 BIMS accessToken 을 돌려준다', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => BIMS_LOGIN_OK });

    const result = await linkBimsIdentity({ upn: 'PYH@bkl.co.kr' }, { _id: 'u1' });

    expect(result).toEqual({ ok: true, sid: 100051, accessToken: 'bims-access-token' });
  });

  test('토큰은 user 객체에도 user 문서에도 싣지 않는다', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => BIMS_LOGIN_OK });
    const user = { _id: 'u1' };

    await linkBimsIdentity({ upn: 'PYH@bkl.co.kr' }, user);

    expect(user.bkl_sid).toBe(100051);
    for (const leaked of [JSON.stringify(user), JSON.stringify(persisted)]) {
      expect(leaked).not.toContain('bims-access-token');
      expect(leaked).not.toContain('bims-refresh-token');
    }
  });

  /** BIMS 장애로 기존 sid 를 쓰는 경로에는 새로 발급된 토큰이 없다. */
  test('기존 sid 폴백 경로에는 토큰이 없다', async () => {
    existingDoc = { bkl_sid: 100051, bkl_login_id: 'PYH' };
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: '아이디가 없거나 패스워드가 맞지 않습니다', errorCode: 'LOGIN02' }),
    });

    const result = await linkBimsIdentity({ upn: 'PYH@bkl.co.kr' }, { _id: 'u1' });

    expect(result).toEqual({ ok: true, sid: 100051 });
  });
});
