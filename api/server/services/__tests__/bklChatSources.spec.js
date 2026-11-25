/**
 * BKL: 공유 링크 출처 스냅샷 (snapshotBklChatSources) — ai-api by-conversation 응답을
 * 그대로 돌려주고, 실패/빈 응답/토큰 없음은 null (공유 생성은 계속된다).
 */
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('@librechat/data-schemas', () => ({
  logger: { warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

describe('snapshotBklChatSources', () => {
  const ORIGINAL_ENV = process.env;
  let snapshotBklChatSources;
  let axios;

  // 모듈 상수(BKL_BASE_URL/TOKEN)가 require 시점에 고정되므로 env 를 먼저 두고
  // 레지스트리를 비운 뒤 다시 읽는다. axios 목도 같은 레지스트리에서 가져와야 한다.
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, IRE_API_TOKEN: 'tok', BKL_API_BASE_URL: 'http://ai-api:8000' };
    axios = require('axios');
    ({ snapshotBklChatSources } = require('../bklChatSources'));
    axios.get.mockReset();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns messages[] from the by-conversation endpoint using the ORIGINAL conversation id', async () => {
    const messages = [
      { request_id: 'r1', message_id: 'm1', sources: [{ document: ['x'] }], hyperlink_map: {} },
    ];
    axios.get.mockResolvedValue({ data: { conversation_id: 'conv-1', messages } });

    const out = await snapshotBklChatSources('conv-1');

    expect(out).toEqual(messages);
    expect(axios.get).toHaveBeenCalledWith(
      'http://ai-api:8000/v1/sources/by-conversation/conv-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
    );
  });

  it('returns null on empty messages, http failure, or missing id', async () => {
    axios.get.mockResolvedValue({ data: { messages: [] } });
    expect(await snapshotBklChatSources('conv-1')).toBeNull();

    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await snapshotBklChatSources('conv-1')).toBeNull();

    expect(await snapshotBklChatSources('')).toBeNull();
  });

  it('returns null without calling the API when IRE_API_TOKEN is unset', async () => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, IRE_API_TOKEN: '' };
    axios = require('axios');
    ({ snapshotBklChatSources } = require('../bklChatSources'));
    expect(await snapshotBklChatSources('conv-1')).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });
});
