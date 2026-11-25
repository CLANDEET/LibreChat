/**
 * 공유 열람 출처 스냅샷 (2026-11-25): 전역 캐시 심기 → `[N]` 칩/패널이 읽는
 * window.__bklSources, rid 등록, 하이퍼링크 지도 캐시(fetch 없이 치환).
 */
import { primeBklShareSnapshot, shareSnapshotByMessage } from '../bklShareSnapshot';
import {
  applyBklAnswerHyperlinks,
  parseHyperlinksResponse,
} from '~/components/Chat/Messages/Content/useBklAnswerHyperlinks';

type W = Window & {
  __bklSources?: Record<string, unknown[]>;
  __bklRids?: Record<string, string>;
};

const entry = {
  request_id: 'req-1',
  message_id: 'msg_anon1',
  sources: [{ document: ['본문'], metadata: [{ doc_id: 'd1', name: '계약서.docx' }] }],
  hyperlink_map: {
    '『계약서.docx』': '[『계약서.docx』](https://im.example/doc/1)',
    __by_doc_id__: { d1: 'https://im.example/doc/1' },
  },
};

beforeEach(() => {
  const w = window as W;
  delete w.__bklSources;
  delete w.__bklRids;
});

describe('primeBklShareSnapshot', () => {
  it('seeds the sources cache and rid registry without touching localStorage', () => {
    const n = primeBklShareSnapshot([entry]);
    const w = window as W;
    expect(n).toBe(1);
    expect(w.__bklSources?.msg_anon1).toEqual(entry.sources);
    expect(w.__bklRids?.msg_anon1).toBe('req-1');
    expect(localStorage.getItem('bkl_src_msg_anon1')).toBeNull();
  });

  it('is a no-op for empty / malformed input', () => {
    expect(primeBklShareSnapshot(null)).toBe(0);
    expect(primeBklShareSnapshot([])).toBe(0);
    expect(primeBklShareSnapshot([{ message_id: '', sources: [] } as never])).toBe(0);
  });

  it('hyperlink map from the snapshot resolves 『파일명』 links like the live endpoint', () => {
    const maps = parseHyperlinksResponse({ mapping: entry.hyperlink_map });
    expect(maps?.byName.get('계약서.docx')).toBe('https://im.example/doc/1');
    const out = applyBklAnswerHyperlinks('근거: 『계약서.docx』 [1]', maps!.byName);
    expect(out).toContain('](<https://im.example/doc/1>)');
  });
});

describe('shareSnapshotByMessage', () => {
  it('maps anonymized message ids to source arrays', () => {
    const m = shareSnapshotByMessage([entry, { message_id: 'msg_anon2', sources: [] }]);
    expect(m.get('msg_anon1')).toHaveLength(1);
    expect(m.get('msg_anon2')).toEqual([]);
    expect(shareSnapshotByMessage(null).size).toBe(0);
  });
});
