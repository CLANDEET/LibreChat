import {
  classifyBklError,
  heuristicBklCode,
  humanizeBklMarkers,
  stripLibreChatErrorPrefix,
} from '../bklErrors';

describe('bklErrors — 코드 유형화', () => {
  it('마커가 있으면 서버 코드와 요청 ID 를 그대로 쓴다', () => {
    const r = classifyBklError(
      'An error occurred while processing the request: 답변 생성 시간 초과 [BKL:LLM_TIMEOUT:req_abc123]',
    );
    expect(r.code).toBe('LLM_TIMEOUT');
    expect(r.requestId).toBe('req_abc123');
    expect(r.fromMarker).toBe(true);
    expect(r.raw).not.toContain('[BKL:');
    expect(r.raw).not.toMatch(/^An error occurred/);
    expect(r.spec.message).toMatch(/다시 시도/);
  });

  it.each([
    ['502 Bad Gateway', 'SERVICE_UNAVAILABLE'],
    ['Error: 505 HTTP Version Not Supported', 'SERVICE_UNAVAILABLE'],
    ['Request failed with status code 503', 'SERVICE_UNAVAILABLE'],
    ['Connection to embedding server qwen3 failed', 'EMBEDDING_UNAVAILABLE'],
    ['qdrant: connection refused', 'SEARCH_BACKEND_UNAVAILABLE'],
    ['anthropic rate_limit_error: quota exceeded', 'LLM_QUOTA'],
    ['Request timed out after 60s', 'RETRIEVAL_TIMEOUT'],
    ['openai: request timed out', 'LLM_TIMEOUT'],
    ['iManage token refresh failed: 401 Unauthorized', 'UPSTREAM_AUTH'],
    ['429 Too Many Requests', 'RATE_LIMITED'],
    ['422 Unprocessable Entity', 'INVALID_INPUT'],
    ['something completely unknown', 'INTERNAL'],
  ])('휴리스틱: %s → %s', (text, code) => {
    expect(heuristicBklCode(text)).toBe(code);
    expect(classifyBklError(text).fromMarker).toBe(false);
  });

  it('bkl-api HTTP 봉투 객체도 받는다', () => {
    const r = classifyBklError({
      error: { code: 'FORBIDDEN', message: '권한 없음', request_id: 'rid-9', retryable: false },
      detail: 'forbidden',
    });
    expect(r.code).toBe('FORBIDDEN');
    expect(r.requestId).toBe('rid-9');
    expect(r.fromMarker).toBe(true);
  });

  it('프리픽스 제거 / 마커 humanize', () => {
    expect(stripLibreChatErrorPrefix('An error occurred while processing the request: x')).toBe(
      'x',
    );
    expect(humanizeBklMarkers('실패했습니다. [BKL:INTERNAL:abc]')).toBe(
      '실패했습니다. (요청 ID: abc)',
    );
    expect(humanizeBklMarkers('실패했습니다. [BKL:INTERNAL]')).toBe('실패했습니다.');
    expect(humanizeBklMarkers('마커 없음')).toBe('마커 없음');
  });
});
