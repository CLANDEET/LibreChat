/**
 * 입력창 위 활성 필터 칩 — 질문 보내기 전에도 무엇이 걸렸는지 보이고,
 * 칩 X 로 해당 항목만 뺄 수 있어야 한다.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecoilRoot, useRecoilValue, useSetRecoilState } from 'recoil';
import store from '~/store';
import type { PeriodFilterState } from '~/store/filters';

jest.mock('~/hooks', () => ({
  __esModule: true,
  useLocalize: () => (key: string) => key,
}));

import BklActiveFilterChips from '../BklActiveFilterChips';

interface Seed {
  period?: Partial<PeriodFilterState>;
  matters?: { matter_uid: string; label: string }[];
  docs?: { doc_id: string; label: string }[];
  pattern?: string | null;
}

const Seeder: React.FC<Seed> = ({ period, matters, docs, pattern }) => {
  const setPeriod = useSetRecoilState(store.periodFilter);
  const setMatters = useSetRecoilState(store.filterBklMatters);
  const setDocs = useSetRecoilState(store.filterBklDocs);
  const setPattern = useSetRecoilState(store.filterBklFileNamePattern);
  React.useEffect(() => {
    if (period) setPeriod((p) => ({ ...p, ...period }));
    if (matters) setMatters(matters);
    if (docs) setDocs(docs);
    if (pattern !== undefined) setPattern(pattern);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

const Probe: React.FC = () => {
  const period = useRecoilValue(store.periodFilter);
  const matters = useRecoilValue(store.filterBklMatters);
  const docs = useRecoilValue(store.filterBklDocs);
  const pattern = useRecoilValue(store.filterBklFileNamePattern);
  return (
    <div data-testid="probe">
      {JSON.stringify({
        preset: period.preset,
        library: period.library,
        ext: period.extensionGroups,
        matters: matters.map((m) => m.matter_uid),
        docs: docs.map((d) => d.doc_id),
        pattern,
      })}
    </div>
  );
};

function setup(seed: Seed) {
  render(
    <RecoilRoot>
      <Seeder {...seed} />
      <BklActiveFilterChips />
      <Probe />
    </RecoilRoot>,
  );
  return () => JSON.parse(screen.getByTestId('probe').textContent || '{}');
}

describe('BklActiveFilterChips', () => {
  it('필터가 없으면 아무것도 그리지 않는다', () => {
    setup({});
    expect(screen.queryByLabelText('적용 중인 필터')).not.toBeInTheDocument();
  });

  it('걸린 필터를 종류별 칩으로 보여준다', () => {
    setup({
      period: { preset: 'last_1_year', library: 'matter', extensionGroups: ['pdf', 'other'] },
      matters: [{ matter_uid: '1001', label: '2024가합100' }],
      docs: [{ doc_id: 'd1', label: '계약서.pdf' }],
      pattern: 'SSA',
    });
    expect(screen.getByText('기간: com_ui_period_last_1_year')).toBeInTheDocument();
    expect(screen.getByText('범위: M 라이브러리')).toBeInTheDocument();
    expect(screen.getByText('확장자: PDF, 기타')).toBeInTheDocument();
    expect(screen.getByText('사건: 2024가합100')).toBeInTheDocument();
    expect(screen.getByText('파일명: SSA')).toBeInTheDocument();
    expect(screen.getByText('문서: 계약서.pdf')).toBeInTheDocument();
  });

  it('커스텀 기간은 날짜 범위로 보여준다', () => {
    setup({ period: { preset: 'custom', startDate: '2025-01-01', endDate: '2025-06-30' } });
    expect(screen.getByText('기간: 2025-01-01 ~ 2025-06-30')).toBeInTheDocument();
  });

  it('칩 X 는 그 항목만 뺀다', () => {
    const state = setup({
      period: { preset: 'last_1_year', library: 'knowledge' },
      matters: [
        { matter_uid: '1001', label: 'A' },
        { matter_uid: '1002', label: 'B' },
      ],
      pattern: 'SSA',
    });
    fireEvent.click(screen.getByRole('button', { name: 'A 사건 필터 제거' }));
    expect(state().matters).toEqual(['1002']);
    fireEvent.click(screen.getByRole('button', { name: '기간 필터 제거' }));
    expect(state().preset).toBe('all');
    fireEvent.click(screen.getByRole('button', { name: "파일명 스코프 'SSA' 제거" }));
    expect(state().pattern).toBeNull();
    // 나머지(범위, 사건 B)는 그대로
    expect(state().library).toBe('knowledge');
    expect(screen.getByText('사건: B')).toBeInTheDocument();
  });

  it('칩이 둘 이상이면 전체 지우기 링크가 붙고 모두 비운다', () => {
    const state = setup({
      period: { preset: 'last_3_months' },
      docs: [{ doc_id: 'd1', label: 'x' }],
    });
    fireEvent.click(screen.getByText('com_ui_period_clear'));
    expect(state()).toEqual({
      preset: 'all',
      library: 'all',
      ext: [],
      matters: [],
      docs: [],
      pattern: null,
    });
    expect(screen.queryByLabelText('적용 중인 필터')).not.toBeInTheDocument();
  });

  it('칩이 하나면 전체 지우기 링크는 없다', () => {
    setup({ pattern: 'SSA' });
    expect(screen.queryByText('com_ui_period_clear')).not.toBeInTheDocument();
  });
});
