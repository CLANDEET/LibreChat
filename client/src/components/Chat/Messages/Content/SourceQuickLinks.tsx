import React from 'react';
import { BookOpen, Building2, ExternalLink, Folder } from 'lucide-react';
import type { BklSource } from './ChunkModal';
import { cn } from '~/utils';
import { useSourceLinks, type SourceLinkSet } from '~/utils/bklSourceLinks';

/**
 * 인용 출처 행에 바로 붙는 3단 링크 — iM 뷰어 · iM 폴더 · BIMS.
 *
 * 코퍼스별 세트 (utils/bklSourceLinks):
 *   M   뷰어 · 폴더 · BIMS   /   DB  뷰어 · 폴더   /   LIB  원문 뷰어
 * 해당 코퍼스에서 기대되는데 아직 없는 링크는 비활성 버튼으로 자리를 지켜
 * 행마다 폭이 들쭉날쭉하지 않게 한다 (조회 중이면 title 로 표시).
 *
 * `variant="icon"` 은 목록 행용 7px 아이콘 버튼, `"label"` 은 패널 헤더용
 * 텍스트 버튼.
 */
export type SourceQuickLinksVariant = 'icon' | 'label';

const BIMS_POPUP_FEATURES =
  'width=1000,height=800,menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes';

type ItemProps = {
  href: string | null;
  label: string;
  title?: string;
  icon: React.ReactNode;
  variant: SourceQuickLinksVariant;
  loading?: boolean;
  popupName?: string;
};

function LinkItem({ href, label, title, icon, variant, loading, popupName }: ItemProps) {
  const base =
    variant === 'icon'
      ? 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md'
      : 'inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs';
  if (!href) {
    const t = loading ? `${label} — 링크 확인 중` : `${label} — 링크 없음`;
    return (
      <button
        type="button"
        disabled
        aria-label={t}
        title={t}
        className={cn(base, 'cursor-not-allowed text-text-tertiary opacity-50')}
      >
        {icon}
        {variant === 'label' ? <span>{label}</span> : null}
      </button>
    );
  }
  const interactive = cn(
    base,
    'text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-medium',
  );
  if (popupName) {
    return (
      <button
        type="button"
        aria-label={title ?? label}
        title={title ?? label}
        onClick={(e) => {
          e.stopPropagation();
          window.open(href, popupName, BIMS_POPUP_FEATURES);
        }}
        className={interactive}
      >
        {icon}
        {variant === 'label' ? <span>{label}</span> : null}
      </button>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={title ?? label}
      title={title ?? label}
      onClick={(e) => e.stopPropagation()}
      className={interactive}
    >
      {icon}
      {variant === 'label' ? <span>{label}</span> : null}
    </a>
  );
}

export function SourceQuickLinksView({
  links,
  variant = 'icon',
  className,
}: {
  links: SourceLinkSet;
  variant?: SourceQuickLinksVariant;
  className?: string;
}) {
  const size = variant === 'icon' ? 13 : 14;
  if (links.corpus === 'LIB') {
    return (
      <span className={cn('flex shrink-0 items-center', className)} data-corpus="LIB">
        <LinkItem
          href={links.viewer}
          label="원문 뷰어"
          title="도서관 원문 보기"
          icon={<BookOpen size={size} aria-hidden="true" />}
          variant={variant}
          loading={links.loading}
        />
      </span>
    );
  }
  const folderTitle =
    links.folderKind === 'workspace'
      ? 'iManage 워크스페이스 열기 (폴더 미확인)'
      : 'iManage 폴더 열기';
  return (
    <span className={cn('flex shrink-0 items-center', className)} data-corpus={links.corpus}>
      <LinkItem
        href={links.viewer}
        label="iM 뷰어"
        title="iManage 원문 열기"
        icon={<ExternalLink size={size} aria-hidden="true" />}
        variant={variant}
        loading={links.loading}
      />
      <LinkItem
        href={links.folder}
        label="iM 폴더"
        title={folderTitle}
        icon={<Folder size={size} aria-hidden="true" />}
        variant={variant}
        loading={links.loading}
      />
      {links.corpus === 'M' ? (
        <LinkItem
          href={links.bims}
          label="BIMS"
          title="BIMS 사건 열기"
          icon={<Building2 size={size} aria-hidden="true" />}
          variant={variant}
          loading={links.loading}
          popupName="bims_popup"
        />
      ) : null}
    </span>
  );
}

export default function SourceQuickLinks({
  source,
  viewerFallback = null,
  variant = 'icon',
  className,
}: {
  source: BklSource | null | undefined;
  /** 청크 메타에 뷰어 링크가 없을 때 쓸 같은 파일의 링크 */
  viewerFallback?: string | null;
  variant?: SourceQuickLinksVariant;
  className?: string;
}) {
  const links = useSourceLinks(source, viewerFallback);
  return <SourceQuickLinksView links={links} variant={variant} className={className} />;
}
