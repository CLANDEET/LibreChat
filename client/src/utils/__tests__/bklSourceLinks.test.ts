import {
  linkSetComplete,
  linkSetFromSource,
  mergeDetails,
  sourceCorpusOf,
} from '../bklSourceLinks';
import type { BklSource } from '~/components/Chat/Messages/Content/ChunkModal';

function src(meta: Record<string, unknown>, source?: Record<string, string>): BklSource {
  return { document: ['x'], metadata: [meta], source } as unknown as BklSource;
}

describe('bklSourceLinks — 코퍼스별 링크 세트', () => {
  it('M: 뷰어·폴더·BIMS 세 개', () => {
    const ls = linkSetFromSource(
      src(
        { doc_id: 'd1', matter_uid: 'M_1', bims_url: 'https://bims/1' },
        { imanage_url: 'https://im/f', imanage_folder_url: 'https://im/folder' },
      ),
    );
    expect(ls.corpus).toBe('M');
    expect(ls.viewer).toBe('https://im/f');
    expect(ls.folder).toBe('https://im/folder');
    expect(ls.folderKind).toBe('folder');
    expect(ls.bims).toBe('https://bims/1');
    expect(linkSetComplete(ls)).toBe(true);
  });

  it('DB: BIMS 는 없고 뷰어·폴더만으로 완결', () => {
    const ls = linkSetFromSource(
      src(
        { doc_id: 'd2', source_library: 'DB', bims_url: 'https://should-not-show' },
        { imanage_url: 'https://im/f', imanage_folder_url: 'https://im/folder' },
      ),
    );
    expect(ls.corpus).toBe('DB');
    expect(ls.bims).toBeNull();
    expect(linkSetComplete(ls)).toBe(true);
    expect(sourceCorpusOf(src({ matter_uid: 'DBLIB_x' }))).toBe('DB');
  });

  it('LIB: 원문 뷰어(source.url)만, 서버 왕복 없음', () => {
    const ls = linkSetFromSource(
      src({ doc_id: 'd3', source_library: 'LIB' }, { url: '/v1/source-files/d3' }),
    );
    expect(ls.corpus).toBe('LIB');
    expect(ls.viewer).toBe('/v1/source-files/d3');
    expect(ls.folder).toBeNull();
    expect(ls.bims).toBeNull();
    expect(linkSetComplete(ls)).toBe(true);
  });

  it('폴더가 없으면 워크스페이스 URL 로 폴백하고 미완결로 본다(재조회 대상)', () => {
    const ls = linkSetFromSource(
      src(
        { doc_id: 'd4', imanage_workspace_url: 'https://im/ws' },
        { imanage_url: 'https://im/f' },
      ),
    );
    expect(ls.folder).toBe('https://im/ws');
    expect(ls.folderKind).toBe('workspace');
    expect(linkSetComplete(ls)).toBe(false);
    const merged = mergeDetails(ls, {
      imanage_folder_url: 'https://im/folder',
      bims_url: 'https://bims/4',
    });
    expect(merged.folder).toBe('https://im/folder');
    expect(merged.folderKind).toBe('folder');
    expect(merged.bims).toBe('https://bims/4');
    expect(merged.loading).toBe(false);
    expect(linkSetComplete(merged)).toBe(true);
  });

  it('서버가 imanage_folder_url_kind=workspace 로 내려주면 그대로 표시', () => {
    const ls = linkSetFromSource(
      src(
        { doc_id: 'd5', imanage_folder_url: 'https://im/ws', imanage_folder_url_kind: 'workspace' },
        { imanage_url: 'https://im/f', bims_url: 'https://bims/5' },
      ),
    );
    expect(ls.folderKind).toBe('workspace');
  });
});
