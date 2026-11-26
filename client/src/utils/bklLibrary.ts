/**
 * iManage 라이브러리 범위 — 채팅 필터 / 문서검색 필터 / 인용 배지가 공유하는 값·라벨.
 *
 *   matter    M 라이브러리 (사건 문서)         source_library "M"
 *   knowledge DB 라이브러리 (지식DB)           source_library "DB"
 *   booklib   도서관 (단행본/간행물/논문)      source_library "LIB"
 *
 * 백엔드 파라미터명이 `library` 라 값으로 "library" 를 쓰면 `library=library` 가 되어
 * 혼동되므로 도서관은 "booklib" 이다. 도서관 문서는 iManage 문서가 아니라 열람
 * 링크(iM 파일/폴더)가 없고, 제목(bims_case_name)·저자(client_name)·분류(custom4)
 * 서지정보만 표시한다.
 */
export type LibraryFilter = 'all' | 'matter' | 'knowledge' | 'booklib';

/** `label` 은 문서검색 FilterBar·활성 칩용, `short` 는 채팅 드롭다운(4칸 한 줄)용. */
export const LIBRARY_FILTER_OPTIONS: { id: LibraryFilter; label: string; short: string }[] = [
  { id: 'all', label: '전체', short: '전체' },
  { id: 'matter', label: 'M 라이브러리', short: 'M' },
  { id: 'knowledge', label: 'DB 라이브러리', short: 'DB' },
  { id: 'booklib', label: '도서실', short: '도서실' },
];

export function libraryFilterLabel(value: string | null | undefined): string {
  const found = LIBRARY_FILTER_OPTIONS.find((o) => o.id === value);
  return found ? found.label : 'M 라이브러리';
}

/** 사건(매터) 선택이 의미 없는 범위 — 지식DB·도서관 문서에는 매터가 없다. */
export function libraryHasNoMatters(value: string | null | undefined): boolean {
  return value === 'knowledge' || value === 'booklib';
}

type MetaLike = Record<string, unknown> | null | undefined;

/** 인용 metadata[0] / 문서검색 hit 가 도서관 문서인지. */
export function isLibrarySource(meta: MetaLike): boolean {
  if (!meta) return false;
  if (meta.source_library === 'LIB') return true;
  const uid = typeof meta.matter_uid === 'string' ? meta.matter_uid : '';
  const wc = typeof meta.workspace_class === 'string' ? meta.workspace_class.toLowerCase() : '';
  return uid.startsWith('LIB_') && wc === 'library';
}

const CATEGORY_LABELS: Record<string, string> = {
  BOOK: '단행본',
  PUBLICATION: '간행물',
  THESIS: '논문',
};

export function libraryCategoryLabel(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const key = raw.trim().toUpperCase();
  return CATEGORY_LABELS[key] ?? raw.trim();
}

/** "저자 · 분류" 한 줄. 둘 다 없으면 null. */
export function libraryBiblioLine(meta: MetaLike): string | null {
  if (!meta) return null;
  const author =
    (typeof meta.library_author === 'string' && meta.library_author) ||
    (typeof meta.client_name === 'string' && meta.client_name) ||
    '';
  const category = libraryCategoryLabel(meta.library_category ?? meta.custom4);
  const parts = [author, category].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : null;
}
