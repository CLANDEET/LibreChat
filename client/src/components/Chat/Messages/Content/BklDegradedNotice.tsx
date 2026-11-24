import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { TMessage } from 'librechat-data-provider';
import { BKL_DEGRADED_EVENT, readBklDegraded, type BklDegradedEvent } from '~/utils/bklDegraded';
import { bklFlowLabel } from '~/utils/bklErrors';

/**
 * 답변 아래 "일부 검색 범위 누락" 경고 — 서버 `degraded` SSE 이벤트가 있을 때만.
 * 세션 내 캐시(window.__bklDegraded)라 새로고침 후에는 사라진다.
 */
export default function BklDegradedNotice({ message }: { message?: TMessage }) {
  const messageId = message?.messageId;
  const [ev, setEv] = useState<BklDegradedEvent | null>(() => readBklDegraded(messageId));

  useEffect(() => {
    setEv(readBklDegraded(messageId));
    if (typeof window === 'undefined') return;
    const onChange = () => setEv(readBklDegraded(messageId));
    window.addEventListener(BKL_DEGRADED_EVENT, onChange);
    return () => window.removeEventListener(BKL_DEGRADED_EVENT, onChange);
  }, [messageId]);

  if (!ev || !ev.flows?.length) return null;

  const labels = ev.labels?.length ? ev.labels : ev.flows.map(bklFlowLabel);
  const reason = ev.reason === 'error' ? '오류' : '시간 초과';
  const text = `${labels.join(', ')} 범위가 ${reason}로 이번 결과에서 빠졌습니다. 다시 질문하면 포함될 수 있습니다.`;

  return (
    <div
      role="status"
      data-testid="bkl-degraded-notice"
      className="inline-flex max-w-full items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      title={ev.request_id ? `요청 ID: ${ev.request_id}` : undefined}
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
