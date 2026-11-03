import React from 'react';
import { BKL_AI_DISCLAIMER } from '~/components/Bkl/brand';
import { cn } from '~/utils';

/**
 * 대화 중 입력창 도구줄 접기 (2026-11-03).
 *
 * 기본은 배지(필터·검색·쿼리 강화)를 접고 면책 문구 한 줄만 보여 읽기 영역을
 * 넓힌다. hover / 키보드 진입 / 파일 첨부 / 배지 편집이면 ChatForm 이 `compact`
 * 를 풀어 200ms 로 펼친다.
 *
 * 가로 접기는 grid `0fr → 1fr` 로 한다. 이때 안쪽은 반드시 `w-max` 여야 한다 —
 * 배지 줄이 flex-wrap 이라 폭이 0 으로 줄면 배지가 한 줄에 하나씩 세로로
 * 쌓여 입력창이 수직으로 늘어난다 (운영에서 겪음). 폭을 접을 수 없는 환경
 * (터치 기기·대기화면)에서는 `collapsible=false` 로 예전처럼 줄바꿈을 허용한다.
 */
export function CollapsibleBadges({
  compact,
  collapsible,
  children,
}: {
  compact: boolean;
  collapsible: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid="bkl-toolbar-badges"
      data-compact={compact ? 'true' : 'false'}
      className={cn(
        'grid transition-[grid-template-columns,opacity] duration-200 ease-out',
        compact ? 'grid-cols-[0fr] opacity-0' : 'grid-cols-[1fr] opacity-100',
      )}
    >
      <div className="min-w-0 overflow-hidden">
        <div className={cn(collapsible && 'w-max')}>{children}</div>
      </div>
    </div>
  );
}

/** 접힌 도구줄 가운데 한 줄 — "Prism은 AI이므로 실수할 수 있습니다." */
export function ToolbarDisclaimer({ visible }: { visible: boolean }) {
  return (
    <span
      aria-hidden={!visible}
      data-testid="bkl-toolbar-disclaimer"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-1/2 -translate-y-[calc(50%+4px)] select-none text-center text-[11px] leading-none text-text-secondary transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      {BKL_AI_DISCLAIMER}
    </span>
  );
}
