/**
 * 공유 열람 출처 패널 (2026-11-25): 스냅샷이 있으면 언급된 파일 / 인용된 청크가
 * 뜨고(읽기 전용 — 체크박스 없음), 없으면 본문만 그대로.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import type { TMessage } from 'librechat-data-provider';
import ShareSourcesLayout from '../ShareSourcesPanel';

jest.mock('@librechat/client', () => {
  const actual = jest.requireActual('@librechat/client');
  return { ...actual, useMediaQuery: () => false };
});

const messages = [
  { messageId: 'msg_u', isCreatedByUser: true, text: '질문' },
  {
    messageId: 'msg_a',
    isCreatedByUser: false,
    text: '답변입니다 [1] 그리고 [2] <!-- bkl_rid:req-1 -->',
  },
] as unknown as TMessage[];

const bklSources = [
  {
    request_id: 'req-1',
    message_id: 'msg_a',
    sources: [
      {
        document: ['첫 청크'],
        metadata: [{ doc_id: 'd1', name: '주식매매계약서.docx', matter_uid: 'M-1' }],
        source: { imanage_url: 'https://im.example/d1' },
      },
      {
        document: ['둘째 청크'],
        metadata: [{ doc_id: 'd2', name: '판결문.pdf', source_library: 'DB' }],
      },
    ],
    hyperlink_map: {},
  },
];

function renderLayout(snapshot: typeof bklSources | null) {
  return render(
    <RecoilRoot>
      <ShareSourcesLayout messages={messages} bklSources={snapshot}>
        <div data-testid="main">본문</div>
      </ShareSourcesLayout>
    </RecoilRoot>,
  );
}

describe('ShareSourcesLayout', () => {
  it('renders only the main content when there is no snapshot (legacy links)', () => {
    renderLayout(null);
    expect(screen.getByTestId('main')).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('shows mentioned files and cited chunks from the snapshot, read-only', () => {
    renderLayout(bklSources);
    const panel = screen.getByRole('complementary', { name: '출처 패널' });
    expect(panel).toBeInTheDocument();
    // 언급된 파일 2 / 인용된 청크 2
    expect(screen.getByText('언급된 파일')).toBeInTheDocument();
    expect(screen.getByText('인용된 청크')).toBeInTheDocument();
    expect(screen.getAllByText('주식매매계약서.docx').length).toBeGreaterThan(0);
    expect(screen.getAllByText('판결문.pdf').length).toBeGreaterThan(0);
    // 읽기 전용 — 프로젝트 담기 체크박스/전체 선택 없음
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('전체 선택')).toBeNull();
  });
});
