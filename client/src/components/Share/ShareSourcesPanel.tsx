import { memo, useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { BookOpen, X } from 'lucide-react';
import type { TBklShareSourceEntry, TMessage } from 'librechat-data-provider';
import {
  useMediaQuery,
  ResizablePanel,
  ResizableHandleAlt,
  ResizablePanelGroup,
} from '@librechat/client';
import { ThreadOverviewView } from '~/components/Chat/BklPanel/BklThreadPanel';
import { aggregateCitations } from '~/components/Chat/BklPanel/useConversationCitations';
import BklSourcesPanel from '~/components/Chat/Messages/Content/BklSourcesPanel';
import { primeBklShareSnapshot, shareSnapshotByMessage } from '~/utils/bklShareSnapshot';
import { cn } from '~/utils';
import store from '~/store';

/**
 * 공유 열람 출처 패널 (2026-11-25).
 *
 * 공유 응답의 `bklSources` 스냅샷으로 채팅의 "대화 자료" 패널(언급된 파일 /
 * 인용된 청크, 코퍼스별 iM 뷰어·iM 폴더·BIMS 링크)과 청크 본문 뷰를 그대로
 * 보여 준다. 로그인·ACL 없음 — 공유 시점에 저장된 것이 전부다.
 *
 * 데스크톱: 본문 오른쪽 리사이즈 패널. 모바일: 하단 버튼 → 전면 오버레이.
 * 스냅샷이 없는(구) 링크는 패널 자체를 두지 않아 기존 화면과 같다.
 */

const PANEL_SIZE_KEY = 'share:sources-panel-size';
const DEFAULT_PANEL_SIZE = 32;

function readPanelSize(): number {
  if (typeof window === 'undefined') return DEFAULT_PANEL_SIZE;
  const n = Number(window.localStorage.getItem(PANEL_SIZE_KEY));
  return Number.isFinite(n) && n >= 20 && n <= 60 ? n : DEFAULT_PANEL_SIZE;
}

/** 스냅샷 집계 (언급된 파일 / 인용된 청크). 캐시 심기는 useShareSnapshotPrime 가 먼저 한다. */
export function useShareCitations(
  messages: TMessage[] | undefined,
  bklSources: TBklShareSourceEntry[] | null | undefined,
) {
  return useMemo(() => {
    const byMessage = shareSnapshotByMessage(bklSources);
    return aggregateCitations(messages, (id) => byMessage.get(id) ?? null);
  }, [messages, bklSources]);
}

/**
 * 스냅샷을 전역 캐시(window.__bklSources 등)에 심는다 — **렌더 중** useMemo 로.
 * 본문의 `[N]` 칩(BklCitation)은 마운트 효과에서 캐시를 먼저 보고, 없으면
 * ai-api 를 부른 뒤 그 결과(익명 열람자 기준 ACL 필터·빈 배열)로 캐시를
 * 덮어쓴다. 자식 효과가 부모 효과보다 먼저 돌기 때문에 효과에서 심으면 늦다.
 * 캐시는 비반응형 전역이고 호출은 멱등이라 렌더 중 써도 안전하다.
 * ShareView 가 메시지 트리를 그리기 전에 호출한다.
 */
export function useShareSnapshotPrime(bklSources: TBklShareSourceEntry[] | null | undefined) {
  useMemo(() => primeBklShareSnapshot(bklSources), [bklSources]);
}

type SharePanelProps = {
  messages: TMessage[];
  bklSources: TBklShareSourceEntry[];
  onClose?: () => void;
};

/** 패널 본체 — Overview ↔ 청크 뷰 2상태 (BklThreadPanel 과 동일). */
function ShareSourcesPanelBody({ messages, bklSources, onClose }: SharePanelProps) {
  const { turns, files } = useShareCitations(messages, bklSources);
  const [active, setActive] = useRecoilState(store.activeBklSource);

  if (active != null) {
    return <BklSourcesPanel onBack={() => setActive(null)} />;
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {onClose ? (
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
      <ThreadOverviewView
        turns={turns}
        files={files}
        isLoading={false}
        readOnly
        title="출처"
        onOpenChunk={(messageId, n) => setActive({ conversationId: null, messageId, n })}
      />
    </div>
  );
}

type LayoutProps = {
  messages: TMessage[];
  bklSources: TBklShareSourceEntry[] | null | undefined;
  children: React.ReactNode;
};

/**
 * 본문 + 출처 패널 레이아웃. 스냅샷이 없으면 children 만 그대로.
 */
function ShareSourcesLayout({ messages, bklSources, children }: LayoutProps) {
  const isSmallScreen = useMediaQuery('(max-width: 1023px)');
  const [panelSize, setPanelSize] = useState(readPanelSize);
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = useRecoilValue(store.activeBklSource);
  const setActive = useSetRecoilState(store.activeBklSource);

  // 공유 화면을 떠날 때 열린 청크를 정리한다 — 채팅의 Presentation 이 하는
  // 라우트 동기화가 여기엔 없다.
  useEffect(() => () => setActive(null), [setActive]);

  // 모바일에서 본문 `[N]` 칩을 누르면 오버레이를 열어 청크를 보여 준다.
  useEffect(() => {
    if (active != null) setMobileOpen(true);
  }, [active]);

  const hasSnapshot = Array.isArray(bklSources) && bklSources.length > 0;
  if (!hasSnapshot) {
    return <>{children}</>;
  }

  if (isSmallScreen) {
    return (
      <>
        {children}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className={cn(
            'fixed bottom-16 right-4 z-30 inline-flex h-10 items-center gap-2 rounded-full border border-border-medium bg-surface-primary px-4 text-sm font-medium text-text-primary shadow-lg hover:bg-surface-hover',
            mobileOpen && 'hidden',
          )}
        >
          <BookOpen size={16} aria-hidden="true" />
          출처
        </button>
        {mobileOpen ? (
          <div
            className="fixed inset-y-0 right-0 z-40 flex w-full max-w-full border-l border-border-light bg-surface-primary shadow-2xl sm:max-w-[420px]"
            role="complementary"
            aria-label="출처 패널"
          >
            <ShareSourcesPanelBody
              messages={messages}
              bklSources={bklSources}
              onClose={() => {
                setMobileOpen(false);
                setActive(null);
              }}
            />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="flex h-full w-full"
      onLayout={(sizes) => {
        const next = sizes[1];
        if (!Number.isFinite(next)) return;
        setPanelSize(next);
        window.localStorage.setItem(PANEL_SIZE_KEY, String(next));
      }}
    >
      <ResizablePanel defaultSize={100 - panelSize} minSize={40} order={1} id="share-main">
        {children}
      </ResizablePanel>
      <ResizableHandleAlt withHandle className="bg-border-medium text-text-primary" />
      <ResizablePanel
        defaultSize={panelSize}
        minSize={20}
        maxSize={50}
        order={2}
        id="share-sources"
      >
        <div
          className="flex h-full w-full border-l border-border-light bg-surface-primary"
          role="complementary"
          aria-label="출처 패널"
        >
          <ShareSourcesPanelBody messages={messages} bklSources={bklSources} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default memo(ShareSourcesLayout);
