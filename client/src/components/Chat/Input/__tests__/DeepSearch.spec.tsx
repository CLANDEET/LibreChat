/**
 * 딥 서치 배지 (2026-11-24): 토글 → recoil atom → localStorage 유지, 켜진 상태 강조,
 * 툴팁 문구. 서버 쪽은 [BKL_DEEP_SEARCH:on] 프리픽스로 재검색 상한 4회.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecoilRoot, useRecoilValue } from 'recoil';
import DeepSearch, { DEEP_SEARCH_TOOLTIP } from '../DeepSearch';
import store from '~/store';

function Probe() {
  const on = useRecoilValue(store.deepSearchEnabled);
  return <span data-testid="probe">{on ? 'on' : 'off'}</span>;
}

afterEach(() => localStorage.clear());

describe('DeepSearch badge', () => {
  it('toggles the atom and persists to localStorage; checked state is highlighted', async () => {
    render(
      <RecoilRoot>
        <DeepSearch />
        <Probe />
      </RecoilRoot>,
    );
    const btn = screen.getByRole('checkbox', { name: '딥 서치' });
    expect(screen.getByTestId('probe')).toHaveTextContent('off');
    expect(btn.className).not.toMatch(/amber/);

    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('on'));
    expect(localStorage.getItem('bkl_deep_search_enabled')).toBe('1');
    await waitFor(() => expect(btn.className).toMatch(/amber/));

    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('off'));
    expect(localStorage.getItem('bkl_deep_search_enabled')).toBeNull();
  });

  it('exposes the tooltip copy and tag text', () => {
    expect(DEEP_SEARCH_TOOLTIP).toBe(
      '딥 서치 — 자료를 더 넓게 다시 찾아봅니다. 답변까지 최대 5분 정도 걸릴 수 있습니다.',
    );
    render(
      <RecoilRoot>
        <DeepSearch />
      </RecoilRoot>,
    );
    expect(screen.getByTestId('bkl-deep-search-badge')).toBeInTheDocument();
  });
});
