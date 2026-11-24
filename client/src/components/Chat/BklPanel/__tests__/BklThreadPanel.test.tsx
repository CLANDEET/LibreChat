/**
 * 우측 대화 패널 "언급된 파일" 다중 선택 → 프로젝트 담기 (2026-09-29).
 *
 * 문서검색 화면처럼 체크박스로 여러 파일을 골라 한 번에 담을 수 있어야 한다.
 * doc_id 없는 파일은 선택 대상이 아니고, 전체 선택/해제와 하단 액션 바의
 * 문서 입력이 선택과 일치하는지 실제 패널을 렌더해 검증한다.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { ProjectDocumentInput } from '~/data-provider/Projects';
import BklThreadPanel, { toProjectDocuments } from '../BklThreadPanel';
import type { MentionedFile } from '../useConversationCitations';

jest.mock('~/data-provider/Sources', () => ({
  useConversationSources: jest.fn(() => ({
    data: undefined,
    isInitialLoading: false,
    refetch: jest.fn(),
  })),
}));

const popoverDocs: ProjectDocumentInput[][] = [];
jest.mock('~/components/Projects/AddToProjectPopover', () => ({
  __esModule: true,
  default: ({
    documents,
    children,
  }: {
    documents: ProjectDocumentInput[];
    children: React.ReactNode;
  }) => {
    popoverDocs.push(documents);
    return <>{children}</>;
  },
}));

const CONVO_ID = 'conv-1';

function makeSource(fileName: string, docId?: string, matterUid?: string, imanageUrl?: string) {
  return {
    document: [`${fileName} 청크 본문`],
    metadata: [
      {
        name: `『${fileName}』- [n]`,
        ...(docId ? { doc_id: docId } : {}),
        ...(matterUid ? { matter_uid: matterUid } : {}),
        ...(imanageUrl ? { imanage_url: imanageUrl } : {}),
      },
    ],
  };
}

const IMANAGE_A = 'https://imanage.example/doc-a';

function renderPanel() {
  const messages: TMessage[] = [
    {
      messageId: 'm-1',
      conversationId: CONVO_ID,
      isCreatedByUser: false,
      text: '근거는 [1], [2], [3], [4] 입니다',
    } as TMessage,
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__bklSources = {
    'm-1': [
      makeSource('계약서.pdf', 'doc-a', 'M-1', IMANAGE_A),
      makeSource('의견서.docx', 'doc-b'),
      makeSource('업로드.pdf'),
      // 같은 문서의 두 번째 청크 — 링크 없이 저장된 경우 (파일 링크로 채워져야 함)
      makeSource('계약서.pdf', 'doc-a', 'M-1'),
    ],
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  client.setQueryData([QueryKeys.messages, CONVO_ID], messages);
  return render(
    <RecoilRoot>
      <MemoryRouter initialEntries={[`/c/${CONVO_ID}`]}>
        <QueryClientProvider client={client}>
          <Routes>
            <Route path="/c/:conversationId" element={<BklThreadPanel />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    </RecoilRoot>,
  );
}

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).__bklSources;
  localStorage.clear();
  popoverDocs.length = 0;
});

describe('toProjectDocuments', () => {
  const files: MentionedFile[] = [
    {
      key: 'doc-a',
      fileName: '계약서.pdf',
      docId: 'doc-a',
      matterUid: 'M-1',
      count: 1,
      imanageUrl: null,
      sample: makeSource('계약서.pdf', 'doc-a'),
    },
    {
      key: '업로드.pdf',
      fileName: '업로드.pdf',
      docId: null,
      matterUid: null,
      count: 1,
      imanageUrl: null,
      sample: makeSource('업로드.pdf'),
    },
  ];

  it('maps selected files with doc_id to chat-origin project inputs', () => {
    expect(toProjectDocuments(files, new Set(['doc-a', '업로드.pdf']), 'bkl')).toEqual([
      {
        doc_id: 'doc-a',
        collection: 'bkl',
        file_name: '계약서.pdf',
        matter_uid: 'M-1',
        origin: 'chat',
      },
    ]);
  });

  it('returns nothing when nothing is selected', () => {
    expect(toProjectDocuments(files, new Set(), null)).toEqual([]);
  });
});

describe('BklThreadPanel multi-select', () => {
  it('shows checkboxes only for files with doc_id and no action bar until selected', () => {
    renderPanel();
    expect(screen.getByLabelText('계약서.pdf 선택')).toBeInTheDocument();
    expect(screen.getByLabelText('의견서.docx 선택')).toBeInTheDocument();
    expect(screen.queryByLabelText('업로드.pdf 선택')).toBeNull();
    expect(screen.queryByText('프로젝트에 담기')).toBeNull();
  });

  it('selecting files shows the action bar with the selected documents', () => {
    localStorage.setItem('bkl_selected_collection', 'bkl');
    renderPanel();
    fireEvent.click(screen.getByLabelText('계약서.pdf 선택'));
    expect(screen.getByText('1건 선택')).toBeInTheDocument();
    expect(screen.getByText('프로젝트에 담기')).toBeInTheDocument();
    expect(popoverDocs[popoverDocs.length - 1]).toEqual([
      {
        doc_id: 'doc-a',
        collection: 'bkl',
        file_name: '계약서.pdf',
        matter_uid: 'M-1',
        origin: 'chat',
      },
    ]);

    fireEvent.click(screen.getByLabelText('선택 해제'));
    expect(screen.queryByText('프로젝트에 담기')).toBeNull();
  });

  it('전체 선택 picks every selectable file and toggles to 전체 해제', () => {
    renderPanel();
    fireEvent.click(screen.getByText('전체 선택'));
    expect(screen.getByText('2건 선택')).toBeInTheDocument();
    expect(popoverDocs[popoverDocs.length - 1].map((d) => d.doc_id)).toEqual(['doc-a', 'doc-b']);

    fireEvent.click(screen.getByText('전체 해제'));
    expect(screen.queryByText('프로젝트에 담기')).toBeNull();
  });
});

describe('BklThreadPanel chunk quick links (iM 뷰어 · iM 폴더 · BIMS)', () => {
  it('shows the viewer link per cited chunk, filled from the file when the chunk lacks one', async () => {
    renderPanel();

    // 계약서.pdf: 청크 [1] 은 자체 링크, 청크 [4] 는 파일 링크 폴백, 파일 행 1개 → 3개
    const links = screen.getAllByLabelText('iManage 원문 열기');
    expect(links).toHaveLength(3);
    links.forEach((a) => expect(a).toHaveAttribute('href', IMANAGE_A));
    // 링크가 전혀 없는 문서(의견서/업로드)는 비활성 자리만 — 청크 2 + 파일 2 = 4
    // (doc_id 있는 의견서는 jsdom 에 fetch 가 없어 즉시 "링크 없음" 으로 정착)
    await waitFor(() => expect(screen.getAllByLabelText(/iM 뷰어 — 링크 없음/)).toHaveLength(4));
    // 폴더·BIMS 는 메타에 없으므로 모든 M 행에서 비활성 자리 유지 (청크 4 + 파일 3)
    expect(screen.getAllByLabelText(/iM 폴더 — 링크 없음/)).toHaveLength(7);
    expect(screen.getAllByLabelText(/BIMS — 링크 없음/)).toHaveLength(7);
  });
});
