/**
 * "검색 문서 리스트" 표의 『파일명』 링크가 실제 <Markdown> 파이프라인(gfm·
 * supersub·directive·bkl-citation 플러그인)을 거쳐도 **파일명 전체가 하나의
 * <a>** 로 남는지 검증한다. 이메일 파일명은 `[BKL-M.FID…]`·`_docnum`·괄호를
 * 품고 있어 마크다운 인라인 문법과 충돌하기 쉽다.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import Markdown from '../Markdown';
import {
  applyBklAnswerHyperlinks,
  normalizeFileKey,
  resolverFromMaps,
} from '../useBklAnswerHyperlinks';
import { getBklDisplayText } from '~/utils';
import { useMessageContext, useMessagesConversation, useMessagesOperations } from '~/Providers';
import { useLocalize } from '~/hooks';
import { useFileDownload } from '~/data-provider';

jest.mock('~/Providers', () => ({
  ...jest.requireActual('~/Providers'),
  useMessageContext: jest.fn(),
  useMessagesConversation: jest.fn(),
  useMessagesOperations: jest.fn(),
}));
jest.mock('~/data-provider');
jest.mock('~/hooks');

const NAMES = [
  'RE_ SPC 대주단 담보 제공 관련 [BKL-M.FID2086960]_4733289.msg',
  '[PDF_Soft] 법률검토보고서 [BKL-M.FID3402242].msg.md',
  '[법무법인(유한) 태평양] 변호인의견서 송부 (정보통신공사업법위반).msg.md',
  'FW_ [외부] 2024_06_14_계약서_v2 [BKL-M.FID28600]_123456789.msg',
  'HDC,LCC_합병,주식취득(일반)_기업결합신고_251126.pdf.md',
  'RE: 담보 검토 *메모* [BKL-M.FID28600].msg',
  '법무법인(유한)태평양 피청구인 답변서 (2022-1386 도로점용허가 반려처분 등 취소_ 신세계건설 주식회사 vs. 양주시장) [BKL-M.FID2859888].msg',
];

const urlFor = (i: number) => `https://imanage.example.com/work/link/d/KR!${1000 + i}.1`;

describe('Markdown × 검색 문서 리스트 파일명 링크', () => {
  beforeEach(() => {
    (useMessageContext as jest.Mock).mockReturnValue({ messageId: 'm1' });
    (useMessagesConversation as jest.Mock).mockReturnValue({ conversationId: 'c1' });
    (useMessagesOperations as jest.Mock).mockReturnValue({ ask: jest.fn(), getMessages: () => [] });
    (useLocalize as jest.Mock).mockReturnValue((k: string) => k);
    (useFileDownload as jest.Mock).mockReturnValue({ refetch: jest.fn() });
  });

  it('renders each 『파일명』 cell as exactly one anchor spanning the whole display name', () => {
    const byName = new Map<string, string>();
    const rows = NAMES.map((n, i) => {
      byName.set(normalizeFileKey(n), urlFor(i));
      return `| ${i + 1} | 2024년 6월 | 『${n}』 | 요약 [${i + 1}] | ○ |`;
    });
    const md = [
      '본문 [1][2].',
      '',
      '## 검색 문서 리스트',
      '',
      '| # | 날짜 | 파일명 | 요약 | 인용 |',
      '|:-:|---|---|---|:-:|',
      ...rows,
      '',
      '<!-- bkl_rid:abc123 -->',
    ].join('\n');
    const text = applyBklAnswerHyperlinks(getBklDisplayText(md), resolverFromMaps(byName));

    const { container } = render(
      <RecoilRoot>
        <Markdown content={text} isLatestMessage={false} />
      </RecoilRoot>,
    );

    const cells = Array.from(container.querySelectorAll('tbody td:nth-child(3)'));
    expect(cells).toHaveLength(NAMES.length);
    cells.forEach((td, i) => {
      const anchors = td.querySelectorAll('a');
      expect(anchors).toHaveLength(1);
      expect(anchors[0].getAttribute('href')).toBe(urlFor(i));
      // 셀 안에 앵커 밖 텍스트가 남지 않는다 (= 파일명 일부만 링크되는 일이 없다)
      expect(anchors[0].textContent).toBe(td.textContent);
      expect(anchors[0].textContent).toMatch(/^『.+』$/);
    });
    // 이스케이프는 렌더 결과에 남지 않는다
    expect(cells[0].textContent).toBe('『RE_ SPC 대주단 담보 제공 관련 [BKL-M.FID2086960].msg』');
    expect(cells[5].textContent).toBe('『RE: 담보 검토 *메모* [BKL-M.FID28600].msg』');
    // 역슬래시 이스케이프(`\[…\]`)는 운영에서 KaTeX 수식이 됐다 — 마크다운에 역슬래시가 남지 않아야 한다
    expect(text).not.toMatch(/\\[[\]_*~`<>\\]/);
    expect(container.querySelector('.katex, .math, math')).toBeNull();
    expect(cells[6].textContent).toContain('[BKL-M.FID2859888].msg』');
  });
});
