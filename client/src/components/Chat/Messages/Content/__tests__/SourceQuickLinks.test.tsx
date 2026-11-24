/**
 * 인용 청크 목록 행의 3단 링크 (iM 뷰어 · iM 폴더 · BIMS) — 2026-11-24.
 * 청크를 열지 않고도 세 링크가 바로 보이고, 빠진 링크는 doc_id 로 보강한다.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import SourceQuickLinks from '../SourceQuickLinks';
import { __resetImanageDetailsCache } from '~/utils/bklSourceLinks';
import type { BklSource } from '../ChunkModal';

function src(meta: Record<string, unknown>, source?: Record<string, string>): BklSource {
  return { document: ['x'], metadata: [meta], source } as unknown as BklSource;
}

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  __resetImanageDetailsCache();
});

describe('SourceQuickLinks', () => {
  it('M 코퍼스: 세 링크를 한 행에 모두 렌더', () => {
    render(
      <SourceQuickLinks
        source={src(
          { doc_id: 'd1', bims_url: 'https://bims/1' },
          { imanage_url: 'https://im/f', imanage_folder_url: 'https://im/folder' },
        )}
      />,
    );
    expect(screen.getByLabelText('iManage 원문 열기')).toHaveAttribute('href', 'https://im/f');
    expect(screen.getByLabelText('iManage 폴더 열기')).toHaveAttribute('href', 'https://im/folder');
    expect(screen.getByLabelText('BIMS 사건 열기')).toBeInTheDocument();
  });

  it('DB 코퍼스: BIMS 자리 없음', () => {
    render(
      <SourceQuickLinks
        source={src(
          { doc_id: 'd2', source_library: 'DB' },
          { imanage_url: 'https://im/f', imanage_folder_url: 'https://im/folder' },
        )}
      />,
    );
    expect(screen.getByLabelText('iManage 원문 열기')).toBeInTheDocument();
    expect(screen.getByLabelText('iManage 폴더 열기')).toBeInTheDocument();
    expect(screen.queryByLabelText(/BIMS/)).toBeNull();
  });

  it('LIB 코퍼스: 원문 뷰어 하나만', () => {
    render(
      <SourceQuickLinks
        source={src({ doc_id: 'd3', source_library: 'LIB' }, { url: '/v1/source-files/d3' })}
      />,
    );
    expect(screen.getByLabelText('도서관 원문 보기')).toHaveAttribute(
      'href',
      '/v1/source-files/d3',
    );
    expect(screen.queryByLabelText(/iManage/)).toBeNull();
    expect(screen.queryByLabelText(/BIMS/)).toBeNull();
  });

  it('폴더·BIMS 가 비어 있으면 /bkl/v1/imanage-links 로 보강한다', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        imanage_url: 'https://im/f',
        imanage_folder_url: 'https://im/folder',
        bims_url: 'https://bims/4',
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<SourceQuickLinks source={src({ doc_id: 'd4' }, { imanage_url: 'https://im/f' })} />);
    // 조회 전: 폴더·BIMS 는 비활성 자리 유지
    expect(screen.getByLabelText(/iM 폴더 — 링크 확인 중/)).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByLabelText('iManage 폴더 열기')).toHaveAttribute(
        'href',
        'https://im/folder',
      ),
    );
    expect(screen.getByLabelText('BIMS 사건 열기')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/bkl/v1/imanage-links/d4');
  });

  it('워크스페이스 폴백은 라벨로 구분한다 (404 면 폴백 유지)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    render(
      <SourceQuickLinks
        source={src(
          {
            doc_id: 'd5',
            imanage_folder_url: 'https://im/ws',
            imanage_folder_url_kind: 'workspace',
            bims_url: 'b',
          },
          { imanage_url: 'https://im/f' },
        )}
      />,
    );
    expect(screen.getByLabelText(/iManage 워크스페이스 열기/)).toHaveAttribute(
      'href',
      'https://im/ws',
    );
    await waitFor(() => expect(screen.getByLabelText('BIMS 사건 열기')).toBeInTheDocument());
    expect(screen.getByLabelText(/iManage 워크스페이스 열기/)).toHaveAttribute(
      'href',
      'https://im/ws',
    );
  });
});
