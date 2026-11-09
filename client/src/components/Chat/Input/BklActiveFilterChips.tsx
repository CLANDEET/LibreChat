import { useRecoilState } from 'recoil';
import { Briefcase, Calendar, FileText, FileType, Library, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { DEFAULT_PERIOD_FILTER } from '~/store/filters';
import type { PeriodFilterPreset } from '~/store/filters';
import store from '~/store';

/**
 * 입력창 위 "지금 걸려 있는 필터" 칩 줄.
 *
 * 질문을 보내기 전에는 필터 아이콘만 파랗게 변해 무엇이 걸렸는지 알 수 없었다.
 * 답변 메타(BklMessageMeta)와 같은 모양의 칩으로 보여주고, 각 칩의 X 로
 * 그 항목만 바로 뺄 수 있게 한다. 상태는 FilterDropdown 과 같은 Recoil atom.
 */

const PRESET_LABEL_KEY: Record<Exclude<PeriodFilterPreset, 'all' | 'custom'>, string> = {
  last_3_months: 'com_ui_period_last_3_months',
  last_6_months: 'com_ui_period_last_6_months',
  last_1_year: 'com_ui_period_last_1_year',
  last_3_years: 'com_ui_period_last_3_years',
  last_5_years: 'com_ui_period_last_5_years',
};

const EXT_LABEL: Record<string, string> = {
  pdf: 'PDF',
  msg: 'MSG',
  docx: 'DOCX',
  hwpx: 'HWPX',
  pptx: 'PPTX',
  other: '기타',
};

interface ChipProps {
  icon: ReactNode;
  label: string;
  onRemove: () => void;
  removeLabel: string;
  className?: string;
}

function Chip({ icon, label, onRemove, removeLabel, className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border-light',
        'bg-surface-secondary py-0.5 pl-2 pr-1 text-[11px] font-medium text-text-secondary',
        className,
      )}
    >
      {icon}
      <span className="max-w-[200px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="rounded-full p-0.5 text-text-tertiary transition hover:bg-surface-hover hover:text-text-primary"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

export default function BklActiveFilterChips() {
  const localize = useLocalize();
  const [periodFilter, setPeriodFilter] = useRecoilState(store.periodFilter);
  const [matters, setMatters] = useRecoilState(store.filterBklMatters);
  const [docs, setDocs] = useRecoilState(store.filterBklDocs);
  const [fileNamePattern, setFileNamePattern] = useRecoilState(store.filterBklFileNamePattern);

  const chips: ReactNode[] = [];

  // 기간
  const preset = periodFilter.preset ?? 'all';
  if (preset === 'custom' && (periodFilter.startDate || periodFilter.endDate)) {
    const label = `${periodFilter.startDate ?? ''} ~ ${periodFilter.endDate ?? ''}`.trim();
    chips.push(
      <Chip
        key="period"
        icon={<Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />}
        label={`기간: ${label}`}
        removeLabel="기간 필터 제거"
        onRemove={() =>
          setPeriodFilter((prev) => ({ ...prev, preset: 'all', startDate: null, endDate: null }))
        }
      />,
    );
  } else if (preset !== 'all' && preset !== 'custom') {
    chips.push(
      <Chip
        key="period"
        icon={<Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />}
        label={`기간: ${localize(PRESET_LABEL_KEY[preset] as Parameters<typeof localize>[0])}`}
        removeLabel="기간 필터 제거"
        onRemove={() =>
          setPeriodFilter((prev) => ({ ...prev, preset: 'all', startDate: null, endDate: null }))
        }
      />,
    );
  }

  // 검색 범위(라이브러리)
  if (periodFilter.library && periodFilter.library !== 'all') {
    chips.push(
      <Chip
        key="library"
        icon={<Library className="h-3 w-3 shrink-0" aria-hidden="true" />}
        label={`범위: ${periodFilter.library === 'knowledge' ? 'DB 라이브러리' : 'M 라이브러리'}`}
        removeLabel="검색 범위 필터 제거"
        onRemove={() => setPeriodFilter((prev) => ({ ...prev, library: 'all' }))}
      />,
    );
  }

  // 확장자
  if (periodFilter.extensionGroups?.length) {
    chips.push(
      <Chip
        key="ext"
        icon={<FileType className="h-3 w-3 shrink-0" aria-hidden="true" />}
        label={`확장자: ${periodFilter.extensionGroups.map((g) => EXT_LABEL[g] ?? g).join(', ')}`}
        removeLabel="확장자 필터 제거"
        onRemove={() => setPeriodFilter((prev) => ({ ...prev, extensionGroups: [] }))}
      />,
    );
  }

  // 사건 — 하나씩
  for (const m of matters) {
    chips.push(
      <Chip
        key={`matter-${m.matter_uid}`}
        icon={<Briefcase className="h-3 w-3 shrink-0 text-blue-500" aria-hidden="true" />}
        label={`케이스: ${m.label || m.matter_uid}`}
        removeLabel={`${m.label || m.matter_uid} 케이스 필터 제거`}
        className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
        onRemove={() => setMatters((prev) => prev.filter((x) => x.matter_uid !== m.matter_uid))}
      />,
    );
  }

  // 파일명 스코프
  const pattern = (fileNamePattern ?? '').trim();
  if (pattern) {
    chips.push(
      <Chip
        key="file-name"
        icon={<Search className="h-3 w-3 shrink-0 text-purple-500" aria-hidden="true" />}
        label={`파일명: ${pattern}`}
        removeLabel={`파일명 스코프 '${pattern}' 제거`}
        className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300"
        onRemove={() => setFileNamePattern(null)}
      />,
    );
  }

  // 개별 문서 — 하나씩
  for (const d of docs) {
    chips.push(
      <Chip
        key={`doc-${d.doc_id}`}
        icon={<FileText className="h-3 w-3 shrink-0 text-purple-500" aria-hidden="true" />}
        label={`문서: ${d.label || d.doc_id}`}
        removeLabel={`${d.label || d.doc_id} 문서 필터 제거`}
        className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300"
        onRemove={() => setDocs((prev) => prev.filter((x) => x.doc_id !== d.doc_id))}
      />,
    );
  }

  if (!chips.length) {
    return null;
  }

  const clearAll = () => {
    setPeriodFilter(DEFAULT_PERIOD_FILTER);
    setMatters([]);
    setDocs([]);
    setFileNamePattern(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-1 pt-2" aria-label="적용 중인 필터">
      {chips}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-0.5 text-[11px] text-text-tertiary underline-offset-2 hover:text-text-primary hover:underline"
        >
          {localize('com_ui_period_clear')}
        </button>
      )}
    </div>
  );
}
