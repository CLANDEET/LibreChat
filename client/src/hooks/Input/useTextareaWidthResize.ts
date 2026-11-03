import { useEffect } from 'react';
import { forceResize } from '~/utils';

/**
 * 입력창 textarea 의 **폭**이 바뀌면 높이를 다시 잰다 (2026-11-03).
 *
 * react-textarea-autosize 는 window resize 에만 반응한다. 대화로 전환할 때 우측
 * 스레드 패널이 열리며 가운데 패널 폭이 요동치는데, 그 좁은 순간에 placeholder
 * ("메시지 BKL Prism")를 글자 단위로 줄바꿈해 잰 높이(수백 px)가 다음 렌더까지
 * 그대로 남아 입력창이 길게 보였다. 폭이 바뀔 때마다 실제 엘리먼트의
 * scrollHeight 로 다시 맞춘다. 패널 리사이즈 중 긴 본문의 줄 수가 바뀌는 경우도
 * 함께 해결된다.
 *
 * `deps` 에는 textarea 가 다시 마운트되는 조건(예: endpoint)을 넣는다 — ref 객체
 * 자체는 바뀌지 않아 effect 가 다시 돌지 않기 때문.
 */
export default function useTextareaWidthResize(
  textAreaRef: React.RefObject<HTMLTextAreaElement>,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    const el = textAreaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    let lastWidth = -1;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      // 높이 변경(forceResize 자신 포함)으로도 콜백이 오므로 폭이 바뀐 때만 처리
      if (Math.abs(width - lastWidth) < 1) {
        return;
      }
      lastWidth = width;
      forceResize(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textAreaRef, ...deps]);
}
