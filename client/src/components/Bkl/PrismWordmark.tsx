import { cn } from '~/utils';

/**
 * "BKL PRISM" 워드마크 — 디자인 팀이 준 로고 이미지(2026-10-19).
 *
 * 예전에는 텍스트 두 조각("BKL" 본문색 + "Prism" 스펙트럼 그라디언트)이었다.
 * 새 로고는 네이비(#003346)에서 틸(#00b7be)로 흐르는 한 덩어리 이미지라
 * 글자로 흉내 내면 폰트·색 모두 어긋난다. 이미지를 그대로 쓰고, 크기는
 * 글꼴 크기(1em)에 맞춰 사이드바·헤더·로그인이 각자 font-size 로 조절한다.
 *
 * 다크 모드에서는 네이비 쪽이 배경에 묻히므로 네이비 끝을 밝힌 변형을 쓴다
 * (틸 끝은 그대로). 두 파일은 같은 원본에서 생성됐다.
 *
 * 스크린리더에는 "BKL Prism" 한 덩어리로 읽힌다 — 이미지 두 장(라이트/다크)을
 * 각각 alt 로 읽히게 두면 두 번 읽힌다.
 */
export const BKL_PRISM_WORDMARK_SRC = '/assets/bkl-prism-wordmark.png';
export const BKL_PRISM_WORDMARK_DARK_SRC = '/assets/bkl-prism-wordmark-dark.png';

export default function PrismWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center whitespace-nowrap', className)}
      role="img"
      aria-label="BKL Prism"
    >
      <img
        src={BKL_PRISM_WORDMARK_SRC}
        alt=""
        draggable={false}
        className="h-[1em] w-auto select-none dark:hidden"
      />
      <img
        src={BKL_PRISM_WORDMARK_DARK_SRC}
        alt=""
        draggable={false}
        className="hidden h-[1em] w-auto select-none dark:block"
      />
    </span>
  );
}
