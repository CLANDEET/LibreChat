/**
 * 사용자 표시용 파일명 (FILENAME_DISPLAY_FIX_SPEC).
 *
 * 수집기는 같은 폴더에 동명 파일이 있을 때만 `_{document_number}` 를 파일명 끝에
 * 붙인다 (이메일 RE: 체인에서 흔함). 이 서픽스와 OCR 산출물 확장자 `.md` 는
 * 사용자에게 의미가 없어 **표시에서만** 걷어낸다.
 *
 * 서버가 `display_name` 을 주면 그걸 쓰고(권위), 없으면(구버전 응답·로컬 캐시)
 * `imanage_document_number` 로 같은 규칙을 클라이언트에서 적용한다.
 *
 * 식별자(doc_id·URL·React key·검색어·프로젝트 저장값)에는 절대 쓰지 말 것.
 */
import { stripDisplayExtension } from './fileTypeIcon';

/** 서버 hyperlink_map 안의 원본 파일명 → 표시명 부속 지도 키 (generate.py HYPERLINK_DISPLAY_KEY). */
export const HYPERLINK_DISPLAY_KEY = '__display_names__';

/**
 * 번호를 모를 때의 보수적 폴백: 확장자(들) 바로 앞의 `_{7~8자리}` (운영 iManage
 * document_number 예: 9319684, 12964400). 8자리가 YYYYMMDD 날짜로 읽히면 보존.
 * 6자리 이하(YYMMDD·호증번호)는 건드리지 않는다. 번호를 아는데 서픽스와 다르면
 * 적용하지 않는다 (서버 display.py 와 같은 규칙).
 */
const HEURISTIC_DOCNUM_RE = /_(\d{7,8})(?=(?:\.[^.\s]+)*$)/;
const YYYYMMDD_RE = /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/;

function stripHeuristicDocnum(name: string): string {
  const m = HEURISTIC_DOCNUM_RE.exec(name);
  if (!m || YYYYMMDD_RE.test(m[1])) return name;
  return name.slice(0, m.index) + name.slice(m.index + m[0].length);
}

/** iManage 문서 id("Mn733289.1", "KR!9319684.3") 또는 링크 URL 에서 번호만. */
export function docnumFromImanageId(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  let s = value.trim().replace(/\/+$/, '');
  if (s.includes('/')) s = s.slice(s.lastIndexOf('/') + 1);
  s = s.split('?')[0];
  const m = s.match(/(\d+)(?:\.\d+)?$/);
  return m ? m[1] : null;
}

export function displayFileName(
  fileName: string | null | undefined,
  documentNumber?: string | number | null,
  { stripMd = true, heuristic = true }: { stripMd?: boolean; heuristic?: boolean } = {},
): string {
  if (!fileName) return '';
  let name = String(fileName);
  if (documentNumber != null && String(documentNumber).trim() !== '') {
    const num = String(documentNumber).trim();
    if (/^\d+$/.test(num)) {
      // 뒤에 확장자(들)만 남는 위치의 _{num} 하나만 — 중간의 같은 숫자·다른 숫자는 보존
      name = name.replace(new RegExp(`_${num}(?=(?:\\.[^.\\s]+)*$)`), '');
    }
  } else if (heuristic) {
    name = stripHeuristicDocnum(name);
  }
  if (stripMd) name = stripDisplayExtension(name).replace(/\.(?:md|markdown)$/i, '');
  return name;
}

type MetaLike = {
  display_name?: unknown;
  imanage_document_number?: unknown;
  imanage_doc_id?: unknown;
  imanage_url?: unknown;
  imanage_preview_url?: unknown;
  name?: unknown;
  file_name?: unknown;
} & Record<string, unknown>;

/** 메타에서 document_number — 명시 필드, 없으면 iManage id/URL 에서 유도. */
export function documentNumberFromMeta(meta: MetaLike | null | undefined): string | null {
  if (!meta) return null;
  const n = meta.imanage_document_number;
  if ((typeof n === 'string' && n.trim()) || typeof n === 'number') return String(n).trim();
  return (
    docnumFromImanageId(meta.imanage_doc_id) ??
    docnumFromImanageId(meta.imanage_url) ??
    docnumFromImanageId(meta.imanage_preview_url)
  );
}

/** `『파일명』- [n]` 헤더에서 파일명만. */
export function stripCitationHeader(raw: string): string {
  const m = raw.normalize('NFC').match(/^『(.+?)』/);
  return (m ? m[1] : raw.normalize('NFC')).trim();
}

/**
 * 출처 metadata[0] 에서 표시용 파일명. `display_name` 우선, 없으면
 * `name`/`file_name` 에서 헤더를 벗기고 `imanage_document_number` 규칙 적용.
 */
export function displayNameFromMeta(meta: MetaLike | null | undefined, fallback = ''): string {
  if (!meta) return fallback;
  if (typeof meta.display_name === 'string' && meta.display_name) {
    return meta.display_name.normalize('NFC');
  }
  const raw = meta.name ?? meta.file_name;
  if (typeof raw !== 'string' || !raw) return fallback;
  return displayFileName(stripCitationHeader(raw), documentNumberFromMeta(meta)) || fallback;
}

/** 문서검색 hit / 프로젝트 문서 / 필터 문서처럼 평면 객체용. */
export function displayNameOf(doc: {
  display_name?: string | null;
  file_name?: string | null;
  imanage_document_number?: string | number | null;
  imanage_doc_id?: string | null;
  imanage_url?: string | null;
  imanage_preview_url?: string | null;
}): string {
  if (doc.display_name) return doc.display_name;
  return displayFileName(doc.file_name, documentNumberFromMeta(doc as MetaLike));
}
