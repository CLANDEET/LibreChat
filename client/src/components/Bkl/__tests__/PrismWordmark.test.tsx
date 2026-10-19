import { render, screen } from '@testing-library/react';
import PrismWordmark, {
  BKL_PRISM_WORDMARK_DARK_SRC,
  BKL_PRISM_WORDMARK_SRC,
} from '../PrismWordmark';

/**
 * 워드마크는 사이드바·헤더·로그인에서 같은 로고 이미지여야 한다. 라이트/다크
 * 이미지 두 장을 쓰지만 보조기술에는 "BKL Prism" 한 덩어리로만 읽혀야 한다 —
 * 각 img 에 alt 를 주면 두 번 읽히고, 아무것도 안 주면 로고가 사라진다.
 */
describe('PrismWordmark', () => {
  it('보조기술에는 "BKL Prism" 한 덩어리로 노출된다', () => {
    render(<PrismWordmark />);
    expect(screen.getByRole('img', { name: 'BKL Prism' })).toBeInTheDocument();
  });

  it('라이트/다크 로고 이미지를 모두 담고, 개별 img 는 읽히지 않는다', () => {
    const { container } = render(<PrismWordmark />);
    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual([
      BKL_PRISM_WORDMARK_SRC,
      BKL_PRISM_WORDMARK_DARK_SRC,
    ]);
    expect(imgs.every((i) => i.getAttribute('alt') === '')).toBe(true);
    expect(imgs[0].className).toContain('dark:hidden');
    expect(imgs[1].className).toContain('dark:block');
  });

  it('높이는 글꼴 크기를 따른다 — 호출부가 font-size 로 크기를 정한다', () => {
    const { container } = render(<PrismWordmark className="text-4xl" />);
    expect(screen.getByRole('img', { name: 'BKL Prism' })).toHaveClass('text-4xl');
    container.querySelectorAll('img').forEach((i) => expect(i.className).toContain('h-[1em]'));
  });
});
