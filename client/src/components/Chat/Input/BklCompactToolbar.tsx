import React from 'react';
import { BKL_AI_DISCLAIMER } from '~/components/Bkl/brand';
import { cn } from '~/utils';

/**
 * 대화 중 입력창 도구줄 접기 (2026-11-03).
 *
 * 대화 중 입력창 박스는 기본적으로 **텍스트 한 줄 + 전송 버튼**만 보인다. 마우스를
 * 올리면(hover) 박스 안 두 번째 줄(첨부·필터·검색·쿼리 강화·마이크)이 세로로
 * 펼쳐져 대기화면과 같은 두 줄 박스가 된다. 키보드 진입(focus-within) / 파일 첨부 /
 * 배지 편집 중에도 ChatForm 이 `compact` 를 풀어 펼친다. hover 가 없는 터치
 * 기기에서는 항상 펼친 상태.
 *
 * 세로 접기는 grid `0fr → 1fr` 로 한다 (height:auto 는 transition 이 안 됨).
 * 접힌 상태에서도 자식은 DOM 에 남아 Tab 으로 들어갈 수 있고, 그 focus 가 펼침
 * 트리거가 된다.
 */
export function CollapsibleToolbar({
  compact,
  children,
}: {
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid="bkl-toolbar-collapsible"
      data-compact={compact ? 'true' : 'false'}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
        compact ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/** 입력창 박스 **바깥** 아래 한 줄 — "Prism은 AI이므로 실수할 수 있습니다." */
export function AiDisclaimer() {
  return (
    <div
      data-testid="bkl-toolbar-disclaimer"
      className="select-none pt-1.5 text-center text-[11px] leading-none text-text-secondary"
    >
      {BKL_AI_DISCLAIMER}
    </div>
  );
}
