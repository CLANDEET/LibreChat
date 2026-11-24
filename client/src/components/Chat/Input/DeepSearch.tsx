import { memo, useCallback } from 'react';
import { Telescope } from 'lucide-react';
import { CheckboxButton, TooltipAnchor } from '@librechat/client';
import { useRecoilState } from 'recoil';
import store from '~/store';

export const DEEP_SEARCH_TOOLTIP =
  '딥 서치 — 자료를 더 넓게 다시 찾아봅니다. 답변까지 최대 5분 정도 걸릴 수 있습니다.';

/**
 * 딥 서치 배지 (QueryEnhance 와 같은 패턴). 켜져 있으면 useSubmitMessage 가
 * 질의 앞에 `[BKL_DEEP_SEARCH:on]` 을 붙이고, 서버는 재검색 상한을 4회로 올린다.
 * 상태가 localStorage 에 남아 "켜 둔 채 잊는" 경우가 있으므로 켜진 배지는
 * 호박색으로 또렷하게 강조한다.
 */
function DeepSearch() {
  const [enabled, setEnabled] = useRecoilState(store.deepSearchEnabled);

  const handleChange = useCallback(
    ({ value }: { value: boolean | string }) => setEnabled(Boolean(value)),
    [setEnabled],
  );

  return (
    <TooltipAnchor
      description={DEEP_SEARCH_TOOLTIP}
      side="top"
      render={<span className="inline-flex max-w-fit" data-testid="bkl-deep-search-badge" />}
    >
      <CheckboxButton
        className="max-w-fit"
        checked={enabled}
        setValue={handleChange}
        label="딥 서치"
        isCheckedClassName="border-amber-500/60 bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 dark:text-amber-200"
        icon={<Telescope className="icon-md" aria-hidden="true" />}
      />
    </TooltipAnchor>
  );
}

export default memo(DeepSearch);
