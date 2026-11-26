import {
  LIBRARY_FILTER_OPTIONS,
  isLibrarySource,
  libraryBiblioLine,
  libraryFilterLabel,
  libraryHasNoMatters,
} from '../bklLibrary';

describe('bklLibrary', () => {
  it('드롭다운 옵션은 전체/M/DB/도서관 — 도서관 value 는 booklib', () => {
    expect(LIBRARY_FILTER_OPTIONS.map((o) => o.id)).toEqual([
      'all',
      'matter',
      'knowledge',
      'booklib',
    ]);
    expect(libraryFilterLabel('booklib')).toBe('도서실');
    expect(libraryFilterLabel('knowledge')).toBe('DB 라이브러리');
    expect(libraryFilterLabel('matter')).toBe('M 라이브러리');
    expect(libraryFilterLabel(undefined)).toBe('M 라이브러리');
  });

  it('지식DB·도서관 범위에는 매터가 없다', () => {
    expect(libraryHasNoMatters('knowledge')).toBe(true);
    expect(libraryHasNoMatters('booklib')).toBe(true);
    expect(libraryHasNoMatters('matter')).toBe(false);
    expect(libraryHasNoMatters('all')).toBe(false);
  });

  it('isLibrarySource: source_library LIB 또는 LIB_ + workspace_class=library', () => {
    expect(isLibrarySource({ source_library: 'LIB' })).toBe(true);
    expect(isLibrarySource({ matter_uid: 'LIB_63342', workspace_class: 'library' })).toBe(true);
    // 접두만 있고 workspace_class 가 다르면 도서관이 아니다 (백엔드 ACL 과 동일한 AND 조건)
    expect(isLibrarySource({ matter_uid: 'LIB_63342', workspace_class: 'matter' })).toBe(false);
    expect(isLibrarySource({ source_library: 'DB' })).toBe(false);
    expect(isLibrarySource(null)).toBe(false);
  });

  it('libraryBiblioLine: 저자 · 분류(한글)', () => {
    expect(libraryBiblioLine({ library_author: '홍길동', library_category: 'THESIS' })).toBe(
      '홍길동 · 논문',
    );
    expect(libraryBiblioLine({ client_name: '김철수', custom4: 'BOOK' })).toBe('김철수 · 단행본');
    expect(libraryBiblioLine({ custom4: 'PUBLICATION' })).toBe('간행물');
    expect(libraryBiblioLine({ custom4: 'OTHER' })).toBe('OTHER');
    expect(libraryBiblioLine({})).toBeNull();
  });
});
