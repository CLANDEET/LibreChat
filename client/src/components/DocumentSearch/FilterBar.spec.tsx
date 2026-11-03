/**
 * 문서 검색 필터 바 — 매터(사건) 선택기.
 *
 * 채팅 필터와 같은 선택 모델(BklMatterSelection)을 쓰고, 내 사건 목록
 * (/bkl/matters)에서 번호·별칭·의뢰인으로 걸러 고른다. DB 라이브러리에는
 * 매터가 없으므로 그 범위에서는 비활성이고 선택도 비워진다.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { BklMatter } from '~/data-provider/Matters/queries';

const mockMatters: BklMatter[] = [
  { matter_uid: '1001', case_number: '2024가합100', case_alias: '세종 M&A', client: '세종텔레콤' },
  { matter_uid: '1002', case_number: '2023가단200', case_alias: '한강 PF', client: '한강건설' },
];

jest.mock('~/data-provider/Matters/queries', () => {
  const actual = jest.requireActual('~/data-provider/Matters/queries');
  return {
    __esModule: true,
    ...actual,
    useBklMattersQuery: () => ({ data: { matters: mockMatters, count: 2 }, isLoading: false }),
  };
});

jest.mock('~/hooks', () => ({
  __esModule: true,
  useLocalize: () => (key: string) => key,
}));

jest.mock('react-day-picker', () => ({
  __esModule: true,
  DayPicker: () => null,
}));

import FilterBar, { EMPTY_DOC_FILTERS, isFilterActive } from './FilterBar';
import type { DocumentSearchFilterState } from './FilterBar';

function renderBar(value: DocumentSearchFilterState = EMPTY_DOC_FILTERS) {
  const onChange = jest.fn();
  render(<FilterBar value={value} onChange={onChange} />);
  return onChange;
}

const openMatterMenu = () => fireEvent.click(screen.getByRole('button', { name: '매터 선택' }));

describe('FilterBar 매터 선택', () => {
  it('기본은 "전체"이고 열면 내 사건 목록이 뜬다', () => {
    renderBar();
    expect(screen.getByRole('button', { name: '매터 선택' })).toHaveTextContent('전체');
    openMatterMenu();
    expect(screen.getByText('세종 M&A')).toBeInTheDocument();
    expect(screen.getByText('한강 PF')).toBeInTheDocument();
  });

  it('검색어로 거르고, 고르면 선택 모델(matter_uid/label/sub)로 onChange 한다', () => {
    const onChange = renderBar();
    openMatterMenu();
    fireEvent.change(screen.getByLabelText('매터 검색'), { target: { value: '한강' } });
    expect(screen.queryByText('세종 M&A')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('한강 PF'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        matters: [{ matter_uid: '1002', label: '2023가단200', sub: '한강건설' }],
      }),
    );
  });

  it('선택된 매터는 버튼 라벨·칩으로 보이고 칩을 누르면 빠진다', () => {
    const selected: DocumentSearchFilterState = {
      ...EMPTY_DOC_FILTERS,
      matters: [
        { matter_uid: '1001', label: '2024가합100' },
        { matter_uid: '1002', label: '2023가단200' },
      ],
    };
    const onChange = renderBar(selected);
    expect(screen.getByRole('button', { name: '매터 선택' })).toHaveTextContent('2024가합100 외 1');
    openMatterMenu();
    // 이미 고른 사건은 후보 목록에서 빠진다
    expect(screen.queryByText('세종 M&A')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2024가합100 매터 제거' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ matters: [{ matter_uid: '1002', label: '2023가단200' }] }),
    );
  });

  it('DB 라이브러리로 바꾸면 매터 버튼이 비활성이고 선택이 비워진다', () => {
    const onChange = renderBar({
      ...EMPTY_DOC_FILTERS,
      matters: [{ matter_uid: '1001', label: '2024가합100' }],
    });
    fireEvent.click(screen.getByRole('radio', { name: 'DB 라이브러리' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ library: 'knowledge', matters: [] }),
    );
  });

  it('DB 라이브러리 상태에서는 매터 버튼이 disabled', () => {
    renderBar({ ...EMPTY_DOC_FILTERS, library: 'knowledge' });
    expect(screen.getByRole('button', { name: '매터 선택' })).toBeDisabled();
  });

  it('매터가 있으면 필터 활성으로 본다', () => {
    expect(isFilterActive(EMPTY_DOC_FILTERS)).toBe(false);
    expect(
      isFilterActive({ ...EMPTY_DOC_FILTERS, matters: [{ matter_uid: '1', label: 'x' }] }),
    ).toBe(true);
  });
});
