import type { TBklShareSourceEntry } from 'librechat-data-provider';
import type { BklSource } from '~/components/Chat/Messages/Content/ChunkModal';
import { primeHyperlinkMapCache } from '~/components/Chat/Messages/Content/useBklAnswerHyperlinks';
import { notifyBklSourcesChanged } from './bklSourcesEvent';
import { registerBklRid } from './bklFilter';

/**
 * 공유 열람(ShareView) — 서버가 공유 응답에 실어 준 출처 스냅샷을 채팅 화면이
 * 쓰는 것과 같은 자리에 심는다. 열람자는 로그인/ACL 없이 보므로 ai-api 를
 * 부르지 않고, 공유 시점에 저장된 것만 그대로 보여 준다.
 *
 *  - `window.__bklSources[messageId]` : `[N]` 칩·청크 패널·대화 자료 집계가 읽는 캐시
 *  - `window.__bklRids[messageId]`    : 본문에 `<!-- bkl_rid -->` 주석이 없는 답변도
 *                                       하이퍼링크 지도를 찾을 수 있게 rid 등록
 *  - 하이퍼링크 캐시(rid → 지도)      : 『파일명』 → URL 치환이 fetch 없이 동작
 *
 * 메모리에만 쓴다 — localStorage 에 남기면 다른 사용자가 같은 브라우저에서
 * 채팅할 때 낡은 스냅샷이 되살아난다 (BklCitation 의 캐시 규칙과 동일).
 */
type BklWindow = Window & {
  __bklSources?: Record<string, BklSource[]>;
};

export function primeBklShareSnapshot(entries: TBklShareSourceEntry[] | null | undefined): number {
  if (typeof window === 'undefined' || !Array.isArray(entries) || entries.length === 0) {
    return 0;
  }
  const win = window as BklWindow;
  win.__bklSources = win.__bklSources ?? {};
  let primed = 0;
  for (const entry of entries) {
    if (!entry || typeof entry.message_id !== 'string' || !entry.message_id) continue;
    const sources = Array.isArray(entry.sources) ? (entry.sources as BklSource[]) : [];
    win.__bklSources[entry.message_id] = sources;
    const rid = typeof entry.request_id === 'string' && entry.request_id ? entry.request_id : null;
    if (rid) {
      registerBklRid(entry.message_id, rid);
      primeHyperlinkMapCache(rid, entry.hyperlink_map ?? null);
    }
    primed += 1;
  }
  if (primed > 0) notifyBklSourcesChanged();
  return primed;
}

/** 스냅샷을 messageId → 출처 배열 맵으로 (패널 집계용). */
export function shareSnapshotByMessage(
  entries: TBklShareSourceEntry[] | null | undefined,
): Map<string, BklSource[]> {
  const out = new Map<string, BklSource[]>();
  for (const entry of entries ?? []) {
    if (!entry || typeof entry.message_id !== 'string') continue;
    out.set(entry.message_id, Array.isArray(entry.sources) ? (entry.sources as BklSource[]) : []);
  }
  return out;
}
