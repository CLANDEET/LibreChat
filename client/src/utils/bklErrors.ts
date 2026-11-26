/**
 * BKL 오류 코드 유형화 — bkl-api `src/api/utils/error_codes.py` 의 프런트 거울.
 *
 * 서버는 사용자에게 보일 문장 끝에 `[BKL:CODE:request_id]` 마커를 붙여 보낸다
 * (스트림 중 오류 / HTTP 봉투 `error.code`). 마커가 없는 raw 텍스트(LibreChat
 * 서버가 `An error occurred while processing the request: 502 Bad Gateway` 처럼
 * 흘려보내는 것)는 여기 휴리스틱으로 같은 코드표에 매핑해, 사용자에게 502/505
 * 같은 숫자 대신 한글 안내 + 요청 ID 만 보이게 한다.
 */

export type BklErrorCode =
  | 'RETRIEVAL_TIMEOUT'
  | 'EMBEDDING_UNAVAILABLE'
  | 'SEARCH_BACKEND_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'LLM_TIMEOUT'
  | 'LLM_QUOTA'
  | 'LLM_UNAVAILABLE'
  | 'UPSTREAM_AUTH'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'PARTIAL_RESULT';

export type BklErrorSpec = {
  code: BklErrorCode;
  title: string;
  message: string;
  retryable: boolean;
};

export const BKL_ERROR_SPECS: Record<BklErrorCode, BklErrorSpec> = {
  RETRIEVAL_TIMEOUT: {
    code: 'RETRIEVAL_TIMEOUT',
    title: '검색 시간 초과',
    message: '문서 검색이 제한 시간 안에 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
  },
  EMBEDDING_UNAVAILABLE: {
    code: 'EMBEDDING_UNAVAILABLE',
    title: '검색 엔진 준비 중',
    message: '검색 엔진(임베딩 서버)에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
  },
  SEARCH_BACKEND_UNAVAILABLE: {
    code: 'SEARCH_BACKEND_UNAVAILABLE',
    title: '검색 저장소 연결 실패',
    message: '문서 검색 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    title: '서비스 일시 중단',
    message: '서비스가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
  },
  LLM_TIMEOUT: {
    code: 'LLM_TIMEOUT',
    title: '답변 생성 시간 초과',
    message:
      '답변 생성이 제한 시간 안에 끝나지 않았습니다. 질문을 조금 줄이거나 다시 시도해 주세요.',
    retryable: true,
  },
  LLM_QUOTA: {
    code: 'LLM_QUOTA',
    title: '모델 사용량 한도',
    message: '답변 모델 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
  },
  LLM_UNAVAILABLE: {
    code: 'LLM_UNAVAILABLE',
    title: '답변 모델 오류',
    message: '답변 모델이 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
  },
  UPSTREAM_AUTH: {
    code: 'UPSTREAM_AUTH',
    title: '연동 시스템 인증 오류',
    message: '연동 시스템(iManage 등) 인증에 실패했습니다. 관리자에게 문의해 주세요.',
    retryable: false,
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    title: '접근 권한 없음',
    message: '요청하신 자료에 접근할 권한이 없습니다.',
    retryable: false,
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    title: '자료 없음',
    message: '요청하신 자료를 찾을 수 없습니다.',
    retryable: false,
  },
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    title: '요청 형식 오류',
    message: '요청 내용에 문제가 있습니다. 입력을 확인한 뒤 다시 시도해 주세요.',
    retryable: false,
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    title: '요청 과다',
    message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
  },
  INTERNAL: {
    code: 'INTERNAL',
    title: '처리 중 오류',
    message:
      '처리 중 오류가 발생했습니다. 같은 문제가 반복되면 요청 ID 와 함께 관리자에게 알려 주세요.',
    retryable: true,
  },
  PARTIAL_RESULT: {
    code: 'PARTIAL_RESULT',
    title: '일부 검색 범위 누락',
    message: '일부 검색 범위가 제한 시간 안에 응답하지 않아 결과에서 빠졌습니다.',
    retryable: true,
  },
};

/** 서버 `FLOW_LABELS` 거울 — degraded 이벤트의 flows → 한글 라벨 */
export const BKL_FLOW_LABELS: Record<string, string> = {
  hybrid: '사건 문서(기본)',
  flow1: '사건 문서(기본)',
  summary: '사건 요약',
  flow2: '사건 요약',
  entity: '인물·조직',
  flow3: '인물·조직',
  graph: '문서 관계',
  flow4: '문서 관계',
  colbert: '정밀 재순위',
  flow5: '정밀 재순위',
  knowledge_db: 'DB 라이브러리',
  flow6: 'DB 라이브러리',
  library: '도서실',
  flow7: '도서실',
};

export function bklFlowLabel(flow: string): string {
  return BKL_FLOW_LABELS[flow] ?? flow;
}

export const BKL_MARKER_RE = /\[BKL:([A-Z_]+)(?::([A-Za-z0-9_-]+))?\]/;
const BKL_MARKER_RE_G = /\s*\[BKL:([A-Z_]+)(?::([A-Za-z0-9_-]+))?\]/g;

const LIBRECHAT_PREFIX_RE = /^\s*An error occurred while processing the request(?::\s*)?/i;

export type BklClassifiedError = {
  code: BklErrorCode;
  spec: BklErrorSpec;
  requestId: string | null;
  /** 마커가 있었는지 (서버가 직접 분류) vs 휴리스틱 매핑 */
  fromMarker: boolean;
  /** 마커·프리픽스를 뗀 원문 — 분류 입력 보존용. 화면에는 렌더하지 않는다. */
  raw: string;
};

function isCode(v: string): v is BklErrorCode {
  return Object.prototype.hasOwnProperty.call(BKL_ERROR_SPECS, v);
}

function statusFromText(text: string): number | null {
  const m =
    text.match(/\b(?:status(?:\s*code)?|HTTP|Error code)\s*[:=]?\s*(\d{3})\b/i) ??
    text.match(/^\s*(\d{3})\s+[A-Z][\w ]+/) ??
    text.match(
      /\b(\d{3})\s+(?:Bad Gateway|Service Unavailable|Gateway Time-?out|HTTP Version Not Supported|Too Many Requests|Unauthorized|Forbidden|Not Found|Unprocessable|Internal Server Error)/i,
    );
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 400 && n <= 599 ? n : null;
}

/** 마커 없는 raw 텍스트 → 코드 (서버 `classify()` 와 같은 순서·규칙) */
export function heuristicBklCode(text: string): BklErrorCode {
  const t = text.toLowerCase();
  const status = statusFromText(text);

  if (/embedding|qwen3|vllm|embed server|임베딩/.test(t)) return 'EMBEDDING_UNAVAILABLE';
  if (/qdrant|elasticsearch|opensearch|search backend/.test(t)) return 'SEARCH_BACKEND_UNAVAILABLE';
  if (/imanage/.test(t) && /(401|403|unauthorized|forbidden|token|auth)/.test(t))
    return 'UPSTREAM_AUTH';
  if (/(rate.?limit|quota|insufficient_quota|credit balance|429)/.test(t)) {
    return /anthropic|openai|gemini|claude|gpt|model|llm/.test(t) ? 'LLM_QUOTA' : 'RATE_LIMITED';
  }
  if (/(timed? ?out|timeout|deadline|cancelled)/.test(t)) {
    return /anthropic|openai|gemini|claude|gpt|model|llm|generat|답변/.test(t)
      ? 'LLM_TIMEOUT'
      : 'RETRIEVAL_TIMEOUT';
  }
  if (
    /(anthropic|openai|gemini|claude|gpt)/.test(t) &&
    /(overloaded|529|500|502|503|unavailable|connection)/.test(t)
  ) {
    return 'LLM_UNAVAILABLE';
  }
  if (status === 401) return 'UPSTREAM_AUTH';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 408 || status === 504) return 'RETRIEVAL_TIMEOUT';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 400 || status === 422) return 'INVALID_INPUT';
  if (status === 502 || status === 503 || status === 505) return 'SERVICE_UNAVAILABLE';
  if (
    /(bad gateway|service unavailable|econnrefused|econnreset|fetch failed|network error|socket hang up)/.test(
      t,
    )
  ) {
    return 'SERVICE_UNAVAILABLE';
  }
  return 'INTERNAL';
}

/** LibreChat 서버가 붙이는 영문 프리픽스 제거 */
export function stripLibreChatErrorPrefix(text: string): string {
  return text.replace(LIBRECHAT_PREFIX_RE, '').trim();
}

/**
 * 오류 텍스트(스트림 본문 / Error 파트 / HTTP 봉투 JSON) → 코드·안내문·요청 ID.
 */
export function classifyBklError(input: unknown): BklClassifiedError {
  let text = '';
  let code: BklErrorCode | null = null;
  let requestId: string | null = null;
  let fromMarker = false;

  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const err = (obj.error && typeof obj.error === 'object' ? obj.error : obj) as Record<
      string,
      unknown
    >;
    if (typeof err.code === 'string' && isCode(err.code)) {
      code = err.code;
      fromMarker = true;
    }
    if (typeof err.request_id === 'string') requestId = err.request_id;
    // 렌더링 계약: 본문은 error.message 만. `detail` 은 하위 호환 필드라 쓰지 않는다
    // (5xx 에선 서버가 "internal error" 로 가리지만, 프런트도 의존하지 않는다).
    text = String(err.message ?? obj.message ?? '');
  } else {
    text = String(input ?? '');
  }

  text = stripLibreChatErrorPrefix(text);
  const m = text.match(BKL_MARKER_RE);
  if (m) {
    if (isCode(m[1])) {
      code = m[1];
      fromMarker = true;
    }
    requestId = requestId ?? m[2] ?? null;
    text = text.replace(BKL_MARKER_RE_G, '').trim();
  }
  if (!requestId) {
    const rid = text.match(/(?:request[_ ]?id|요청 ?ID)\s*[:=]?\s*([A-Za-z0-9_-]{6,})/i);
    if (rid) requestId = rid[1];
  }
  if (!code) code = heuristicBklCode(text);
  return { code, spec: BKL_ERROR_SPECS[code], requestId, fromMarker, raw: text };
}

/**
 * 답변 본문에 섞여 들어온 마커를 사람이 읽을 수 있는 꼬리표로 바꾼다
 * (`… 잠시 후 다시 시도해 주세요. [BKL:LLM_TIMEOUT:abc123]`
 *  → `… 잠시 후 다시 시도해 주세요. (요청 ID: abc123)`).
 */
export function humanizeBklMarkers(text: string): string {
  if (!text || !text.includes('[BKL:')) return text;
  return text.replace(BKL_MARKER_RE_G, (_all, _code: string, rid?: string) =>
    rid ? ` (요청 ID: ${rid})` : '',
  );
}
