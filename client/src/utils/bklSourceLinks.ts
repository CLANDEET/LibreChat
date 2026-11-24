/**
 * 인용 출처의 외부 링크 세트 — 코퍼스별로 다르다.
 *
 *   사건(M)      iM 뷰어 · iM 폴더 · BIMS
 *   지식DB(DB)   iM 뷰어 · iM 폴더            (bims_url 없음)
 *   도서관(LIB)  원문 뷰어(source_url)         (iM · BIMS 모두 없음)
 *
 * 2026-11-24: 청크를 눌러 한 뎁스 들어가야 iM/BIMS 링크가 보이는 게 번거롭다는
 * 의견 → 인용 청크 목록 행에 세 링크를 바로 노출한다. 캐시된 출처에 폴더/BIMS
 * URL 이 빠져 있으면 `/bkl/v1/imanage-links/{doc_id}` 로 보강한다 (문서당 1회).
 */
import { useEffect, useState } from 'react';
import type { BklSource } from '~/components/Chat/Messages/Content/ChunkModal';
import { isLibrarySource } from './bklLibrary';

export type SourceCorpus = 'M' | 'DB' | 'LIB';

export type SourceLinkSet = {
  corpus: SourceCorpus;
  /** iM 뷰어(파일) — LIB 는 원문 뷰어(source_url) */
  viewer: string | null;
  /** iM 폴더 (없으면 워크스페이스 URL 폴백 — folderKind='workspace') */
  folder: string | null;
  folderKind: 'folder' | 'workspace' | null;
  bims: string | null;
  /** doc_id 조회가 아직 진행 중인지 (disabled 표시용) */
  loading: boolean;
};

type Meta = Record<string, unknown>;
export type ImanageDetails = Record<string, unknown>;

function meta0(source: BklSource | null | undefined): Meta {
  const m = source?.metadata?.[0];
  return m && typeof m === 'object' ? (m as Meta) : {};
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

function kindOf(v: unknown): 'folder' | 'workspace' {
  return v === 'workspace' ? 'workspace' : 'folder';
}

export function sourceDocIdOf(source: BklSource | null | undefined): string | null {
  const m = meta0(source);
  if (str(m.doc_id)) return m.doc_id as string;
  const url = source?.source?.url ?? source?.source?.embed_url;
  if (typeof url !== 'string' || !url.includes('/v1/source-files/')) return null;
  return decodeURIComponent(url.split('/v1/source-files/')[1]?.split(/[?#]/)[0] ?? '') || null;
}

export function sourceCorpusOf(source: BklSource | null | undefined): SourceCorpus {
  const m = meta0(source);
  if (isLibrarySource(m)) return 'LIB';
  const lib = str(m.source_library)?.toUpperCase();
  if (lib === 'DB') return 'DB';
  const uid = str(m.matter_uid) ?? '';
  if (uid.startsWith('DBLIB_')) return 'DB';
  return 'M';
}

/** 출처 payload 에 이미 실린 값만으로 링크 세트. */
export function linkSetFromSource(source: BklSource | null | undefined): SourceLinkSet {
  const m = meta0(source);
  const s = (source?.source ?? {}) as Record<string, unknown>;
  const corpus = sourceCorpusOf(source);
  if (corpus === 'LIB') {
    return {
      corpus,
      viewer: str(s.url) ?? str(s.embed_url) ?? str(m.source_url) ?? null,
      folder: null,
      folderKind: null,
      bims: null,
      loading: false,
    };
  }
  const folder = str(s.imanage_folder_url) ?? str(m.imanage_folder_url);
  const workspace = str(s.imanage_workspace_url) ?? str(m.imanage_workspace_url);
  let folderKind: SourceLinkSet['folderKind'] = null;
  if (folder) {
    folderKind = kindOf(m.imanage_folder_url_kind);
  } else if (workspace) {
    folderKind = 'workspace';
  }
  return {
    corpus,
    viewer:
      str(s.imanage_url) ??
      str(s.imanage_preview_url) ??
      str(m.imanage_url) ??
      str(m.imanage_preview_url),
    folder: folder ?? workspace,
    folderKind,
    bims: corpus === 'M' ? (str(s.bims_url) ?? str(m.bims_url)) : null,
    loading: false,
  };
}

export function mergeDetails(base: SourceLinkSet, d: ImanageDetails | null): SourceLinkSet {
  if (!d || base.corpus === 'LIB') return { ...base, loading: false };
  const viewer = str(d.imanage_url) ?? str(d.imanage_preview_url) ?? base.viewer;
  const folder = str(d.imanage_folder_url) ?? base.folder;
  const folderKind = str(d.imanage_folder_url)
    ? kindOf(d.imanage_folder_url_kind)
    : base.folderKind;
  return {
    ...base,
    viewer,
    folder,
    folderKind,
    bims: base.corpus === 'M' ? (str(d.bims_url) ?? base.bims) : null,
    loading: false,
  };
}

/** 세 링크가 모두 채워졌는지 — 채워졌으면 서버 왕복을 건너뛴다. */
export function linkSetComplete(ls: SourceLinkSet): boolean {
  if (ls.corpus === 'LIB') return true;
  if (!ls.viewer || !ls.folder || ls.folderKind === 'workspace') return false;
  return ls.corpus === 'DB' ? true : Boolean(ls.bims);
}

// doc_id → `/v1/imanage-links` 응답. PG document_tags 는 세션 중 바뀌지 않으므로
// 문서당 한 번만 왕복하고, 동시 호출은 진행 중인 Promise 를 공유한다.
// 404/403(링크 없음·권한 없음)는 정상 응답이라 null 로 캐시하고, 전송 실패만
// 캐시하지 않아 다음 마운트에서 다시 시도한다.
const detailsCache = new Map<string, ImanageDetails | null>();
const detailsInflight = new Map<string, Promise<ImanageDetails | null>>();

export function fetchImanageDetails(docId: string): Promise<ImanageDetails | null> {
  if (detailsCache.has(docId)) {
    return Promise.resolve(detailsCache.get(docId) ?? null);
  }
  const pending = detailsInflight.get(docId);
  if (pending) return pending;
  if (typeof fetch !== 'function') return Promise.resolve(null);

  const request = fetch(`/bkl/v1/imanage-links/${encodeURIComponent(docId)}`)
    .then((r) => {
      if (r.status === 404 || r.status === 403) return null;
      if (!r.ok) throw new Error(`imanage-links ${r.status}`);
      return r.json() as Promise<ImanageDetails>;
    })
    .then((details) => {
      detailsCache.set(docId, details);
      return details;
    })
    .catch(() => null)
    .finally(() => {
      detailsInflight.delete(docId);
    });

  detailsInflight.set(docId, request);
  return request;
}

/** 테스트용 — 캐시 비우기. */
export function __resetImanageDetailsCache(): void {
  detailsCache.clear();
  detailsInflight.clear();
}

/**
 * 출처 하나의 링크 세트. payload 값으로 즉시 그리고, 빠진 링크가 있으면
 * doc_id 로 서버에서 보강한다.
 */
export function useSourceLinks(
  source: BklSource | null | undefined,
  /** 청크 자체 메타에 뷰어 링크가 없을 때 같은 파일의 다른 청크에서 받은 값 */
  viewerFallback: string | null = null,
): SourceLinkSet {
  const [links, setLinks] = useState<SourceLinkSet>(() =>
    withViewerFallback(linkSetFromSource(source), viewerFallback),
  );

  useEffect(() => {
    const base = withViewerFallback(linkSetFromSource(source), viewerFallback);
    const docId = sourceDocIdOf(source);
    if (!docId || linkSetComplete(base) || typeof fetch !== 'function') {
      setLinks(base);
      return;
    }
    let cancelled = false;
    setLinks({ ...base, loading: true });
    fetchImanageDetails(docId).then((d) => {
      if (cancelled) return;
      setLinks(mergeDetails(base, d));
    });
    return () => {
      cancelled = true;
    };
  }, [source, viewerFallback]);

  return links;
}

function withViewerFallback(ls: SourceLinkSet, viewerFallback: string | null): SourceLinkSet {
  if (ls.viewer || !viewerFallback || ls.corpus === 'LIB') return ls;
  return { ...ls, viewer: viewerFallback };
}
