/**
 * PDF 내보내기(인쇄 문서 빌더) — 인용 파일명 치환·HTML 조립 (2026-08-26).
 */
import {
  buildPrintHtml,
  citationFileName,
  replaceCitationsWithFilenames,
} from '../exportPrint';
import type { BklSource } from '~/components/Chat/Messages/Content/ChunkModal';

const src = (name: string): BklSource => ({
  document: [''],
  metadata: [{ name }],
});

const SOURCES: BklSource[] = [
  src('『계약서.pdf.md』 p.2'),
  src('신청서 보완1차.hwp.md'),
  src('감사원 제보서.docx'),
];

describe('citationFileName', () => {
  it('extracts 『…』 prefix and strips OCR .md', () => {
    expect(citationFileName(SOURCES[0])).toBe('계약서.pdf');
    expect(citationFileName(SOURCES[1])).toBe('신청서 보완1차.hwp');
    expect(citationFileName(SOURCES[2])).toBe('감사원 제보서.docx');
    expect(citationFileName(undefined)).toBe('');
  });
});

describe('replaceCitationsWithFilenames', () => {
  it('replaces [[N]](url) streaming links', () => {
    expect(replaceCitationsWithFilenames('근거는 [[1]](https://x) 참조', SOURCES)).toBe(
      '근거는 『계약서.pdf』 참조',
    );
  });

  it('replaces plain [N] and grouped [1, 2] citations', () => {
    expect(replaceCitationsWithFilenames('내역 [2][3]', SOURCES)).toBe(
      '내역 『신청서 보완1차.hwp』『감사원 제보서.docx』',
    );
    expect(replaceCitationsWithFilenames('내역 [1, 2]', SOURCES)).toBe(
      '내역 『계약서.pdf』『신청서 보완1차.hwp』',
    );
  });

  it('dedupes consecutive identical filenames within one group', () => {
    const dup = [src('a.pdf'), src('a.pdf')];
    expect(replaceCitationsWithFilenames('[1, 2]', dup)).toBe('『a.pdf』');
  });

  it('keeps [N] when the source is missing', () => {
    expect(replaceCitationsWithFilenames('근거 [9]', SOURCES)).toBe('근거 [9]');
    expect(replaceCitationsWithFilenames('근거 [1]', [])).toBe('근거 [1]');
    expect(replaceCitationsWithFilenames('근거 [1]', null)).toBe('근거 [1]');
  });

  it('replaces three-digit citations too', () => {
    // `\d{1,2}` 였을 때 [120] 이후가 파일명으로 안 바뀌고 그대로 인쇄됐다.
    const many = Array.from({ length: 126 }, (_, i) => src(`문서${i + 1}.msg`));
    expect(replaceCitationsWithFilenames('기속행위 [124] .', many)).toBe(
      '기속행위 『문서124.msg』 .',
    );
    expect(replaceCitationsWithFilenames('근거 [120, 126]', many)).toBe(
      '근거 『문서120.msg』『문서126.msg』',
    );
    expect(replaceCitationsWithFilenames('링크 [[125]](https://x)', many)).toBe(
      '링크 『문서125.msg』',
    );
  });

  it('leaves a four-digit year alone when no such source exists', () => {
    expect(replaceCitationsWithFilenames('판결 [2024] 참고', SOURCES)).toBe('판결 [2024] 참고');
  });

  it('does not touch normal markdown links like [1](url)', () => {
    expect(replaceCitationsWithFilenames('각주 [1](https://x)', SOURCES)).toBe(
      '각주 [1](https://x)',
    );
  });
});

describe('buildPrintHtml', () => {
  it('assembles a full document with escaped title and blocks', () => {
    const html = buildPrintHtml({
      title: '검토 <중요> & 보고',
      documentTitle: '내보내기.pdf',
      metaLines: ['대화 ID: abc'],
      blocks: [
        { sender: 'User', isUser: true, html: '<p>질문</p>' },
        { sender: 'BKL DB AI', isUser: false, html: '<table><tr><td>표</td></tr></table>' },
      ],
    });
    expect(html).toContain('<title>내보내기.pdf</title>');
    expect(html).toContain('검토 &lt;중요&gt; &amp; 보고');
    expect(html).toContain('msg-user');
    expect(html).toContain('msg-assistant');
    expect(html).toContain('<table><tr><td>표</td></tr></table>');
    expect(html).toContain('@page');
  });
});
