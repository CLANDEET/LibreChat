/**
 * `{"type":"degraded"}` SSE 이벤트 캐시 — 일부 검색 플로우(도서관·DB 등)가
 * 타임아웃/오류로 결과에서 빠졌을 때 서버가 답변 끝에 보낸다. 출처 캐시와
 * 같은 방식으로 rid → messageId 로 이관하고, 답변 아래 경고 칩이 구독한다.
 */
export type BklDegradedEvent = {
  type: 'degraded';
  code?: string;
  flows: string[];
  labels?: string[];
  reason?: string;
  message?: string;
  request_id?: string;
};

export const BKL_DEGRADED_EVENT = 'bkl:degraded-changed';

type Win = Window & {
  __bklDegradedByRid?: Record<string, BklDegradedEvent>;
  __bklDegraded?: Record<string, BklDegradedEvent>;
};

function win(): Win | null {
  return typeof window === 'undefined' ? null : (window as Win);
}

export function isBklDegradedEvent(data: unknown): data is BklDegradedEvent {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.type === 'degraded' && Array.isArray(d.flows);
}

export function cacheBklDegradedByRid(event: BklDegradedEvent, rid: string | null): void {
  const w = win();
  const key = rid ?? event.request_id;
  if (!w || !key) return;
  w.__bklDegradedByRid = w.__bklDegradedByRid ?? {};
  w.__bklDegradedByRid[key] = event;
}

/** final 시점 — rid 캐시를 messageId 로 이관하고 구독자에게 알린다. */
export function promoteBklDegraded(rid: string | null, messageId: string | undefined): void {
  const w = win();
  if (!w || !rid || !messageId) return;
  const ev = w.__bklDegradedByRid?.[rid];
  if (!ev) return;
  w.__bklDegraded = w.__bklDegraded ?? {};
  w.__bklDegraded[messageId] = ev;
  w.setTimeout(() => w.dispatchEvent(new Event(BKL_DEGRADED_EVENT)), 0);
}

export function readBklDegraded(messageId: string | undefined): BklDegradedEvent | null {
  const w = win();
  if (!w || !messageId) return null;
  return w.__bklDegraded?.[messageId] ?? null;
}
