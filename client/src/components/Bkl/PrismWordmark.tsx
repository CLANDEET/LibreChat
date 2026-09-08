import { cn } from '~/utils';

/** 워드마크에서 `Prism` 을 칠하는 방식. */
export type PrismTone =
  /** 4색 스펙트럼 그라디언트. 로그인 히어로처럼 큰 글자에서만 제대로 읽힌다. */
  | 'spectrum'
  /** 단색 브랜드 accent. 사이드바·헤더 같은 14px 안팎에서 쓴다. */
  | 'accent'
  /** 주변 본문색 그대로 — 색을 못 쓰는 자리. */
  | 'inherit';

/**
 * "BKL Prism" 워드마크.
 *
 * 서비스 이름은 프리즘이 백색광을 스펙트럼으로 나눈다는 데서 왔고, 브랜드
 * 정의상 `BKL` 은 본문색, `Prism` 만 색을 입는다. 사이드바 · 헤더 · 로그인이
 * 각자 문자열을 들고 있으면 표기가 어긋나므로 여기 하나로 모은다.
 *
 * tone 을 나눈 이유: 스펙트럼은 네 색이 글자 폭 안에서 전부 전환되는 그라디언트라
 * 큰 글자에서는 이름의 유래가 그대로 보이지만, 14px 사이드바에서는 색이 뭉개져
 * 렌더링 오류처럼 보인다. 작은 자리는 accent 단색으로 떨어뜨린다.
 *
 * 스크린리더에는 조각이 아니라 "BKL Prism" 한 덩어리로 읽히게 한다 — span 을
 * 나눠두면 읽기 단위가 끊긴다.
 */
export default function PrismWordmark({
  className,
  tone = 'accent',
}: {
  className?: string;
  tone?: PrismTone;
}) {
  return (
    <span className={cn('whitespace-nowrap', className)} aria-label="BKL Prism">
      <span aria-hidden="true">BKL </span>
      <span
        aria-hidden="true"
        className={cn(
          tone === 'spectrum' && 'prism-spectrum-text',
          tone === 'accent' && 'text-[color:var(--prism-accent)]',
        )}
      >
        Prism
      </span>
    </span>
  );
}
