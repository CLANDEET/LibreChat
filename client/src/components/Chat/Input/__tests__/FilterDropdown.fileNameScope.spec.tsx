/**
 * 채팅 필터 — 문서 탭 파일명 스코프.
 *
 * "SSA" 를 치면 개별 문서 후보 위에 "'SSA' 포함 문서 전체 적용 (N건)" 행이
 * 뜨고, 누르면 `filterBklFileNamePattern` 에 저장돼 칩으로 보인다. 개별
 * 문서 선택과는 공존하며, 전체 초기화 시 함께 비워진다.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecoilRoot, useRecoilValue } from 'recoil';
import store from '~/store';

jest.mock('~/hooks', () => ({
  __esModule: true,
  useLocalize: () => (key: string) => key,
}));

jest.mock('@librechat/client', () => ({
  __esModule: true,
  TooltipAnchor: ({ render: r }: { render: React.ReactNode }) => <>{r}</>,
}));

jest.mock('react-day-picker', () => ({ __esModule: true, DayPicker: () => null }));

const mockDocs = {
  docs: [
    { doc_id: 'd1', file_name: 'SSA_초안_1234567.pdf', display_name: 'SSA_초안.pdf' },
    { doc_id: 'd2', file_name: '수정 SSA.docx', display_name: '수정 SSA.docx' },
  ],
  total: 42,
};
let mockDocsData: typeof mockDocs | { docs: typeof mockDocs.docs } = mockDocs;

jest.mock('~/data-provider/Matters/queries', () => {
  const actual = jest.requireActual('~/data-provider/Matters/queries');
  return {
    __esModule: true,
    ...actual,
    useBklMattersQuery: () => ({ data: { matters: [], count: 0 } }),
    useBklDocsQuery: (q: string) => ({
      data: q.trim().length >= 2 ? mockDocsData : undefined,
      isFetching: false,
    }),
  };
});

import FilterDropdown, { fileNameScopeLabel } from '../FilterDropdown';

const Probe: React.FC = () => {
  const pattern = useRecoilValue(store.filterBklFileNamePattern);
  const docs = useRecoilValue(store.filterBklDocs);
  return (
    <div data-testid="probe">{JSON.stringify({ pattern, docs: docs.map((d) => d.doc_id) })}</div>
  );
};

function setup() {
  render(
    <RecoilRoot>
      <FilterDropdown />
      <Probe />
    </RecoilRoot>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.click(screen.getByRole('tab', { name: /문서/ }));
  return {
    state: () => JSON.parse(screen.getByTestId('probe').textContent || '{}'),
    type: (v: string) =>
      fireEvent.change(screen.getByPlaceholderText('문서명/문서번호 검색'), {
        target: { value: v },
      }),
  };
}

describe('fileNameScopeLabel', () => {
  it('건수가 있으면 붙이고 없으면 생략한다', () => {
    expect(fileNameScopeLabel(' SSA ', 42)).toBe("'SSA' 포함 문서 전체 적용 (42건)");
    expect(fileNameScopeLabel('SSA', undefined)).toBe("'SSA' 포함 문서 전체 적용");
    expect(fileNameScopeLabel('SSA', null)).toBe("'SSA' 포함 문서 전체 적용");
  });
});

describe('FilterDropdown 문서 탭 — 파일명 스코프', () => {
  beforeEach(() => {
    mockDocsData = mockDocs;
  });

  it('검색어를 치면 개별 후보 위에 "전체 적용 (N건)" 행이 뜬다', () => {
    const t = setup();
    t.type('SSA');
    expect(screen.getByText("'SSA' 포함 문서 전체 적용 (42건)")).toBeInTheDocument();
    expect(screen.getByText('SSA_초안.pdf')).toBeInTheDocument();
  });

  it('total 이 없으면(구버전 백엔드) 건수 없이 보여준다', () => {
    mockDocsData = { docs: mockDocs.docs };
    const t = setup();
    t.type('SSA');
    expect(screen.getByText("'SSA' 포함 문서 전체 적용")).toBeInTheDocument();
  });

  it('"전체 적용"을 누르면 패턴이 저장되고 칩으로 보이며 검색어는 비워진다', () => {
    const t = setup();
    t.type('SSA');
    fireEvent.click(screen.getByText("'SSA' 포함 문서 전체 적용 (42건)"));
    expect(t.state().pattern).toBe('SSA');
    expect(screen.getByText('파일명: SSA')).toBeInTheDocument();
    expect((screen.getByPlaceholderText('문서명/문서번호 검색') as HTMLInputElement).value).toBe(
      '',
    );
  });

  it('개별 문서 선택과 공존한다', () => {
    const t = setup();
    t.type('SSA');
    fireEvent.click(screen.getByText("'SSA' 포함 문서 전체 적용 (42건)"));
    t.type('SSA');
    fireEvent.click(screen.getByText('수정 SSA.docx'));
    expect(t.state()).toEqual({ pattern: 'SSA', docs: ['d2'] });
    expect(screen.getByText('파일명: SSA')).toBeInTheDocument();
    expect(screen.getByText('수정 SSA.docx')).toBeInTheDocument();
  });

  it('칩의 X 로 패턴만 제거한다', () => {
    const t = setup();
    t.type('SSA');
    fireEvent.click(screen.getByText("'SSA' 포함 문서 전체 적용 (42건)"));
    fireEvent.click(screen.getByRole('button', { name: "파일명 스코프 'SSA' 제거" }));
    expect(t.state().pattern).toBeNull();
    expect(screen.queryByText('파일명: SSA')).not.toBeInTheDocument();
  });

  it('전체 초기화(com_ui_period_clear)에 패턴도 포함된다', () => {
    const t = setup();
    t.type('SSA');
    fireEvent.click(screen.getByText("'SSA' 포함 문서 전체 적용 (42건)"));
    fireEvent.click(screen.getByText('com_ui_period_clear'));
    expect(t.state().pattern).toBeNull();
  });
});
