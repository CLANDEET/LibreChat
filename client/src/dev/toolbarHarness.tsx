/* eslint-disable i18next/no-literal-string */
/**
 * 개발 전용 하네스 — 대화 중 입력창 도구줄 접기 (BklCompactToolbar) 육안 검증.
 *
 * ChatForm 의 입력창 박스·도구줄 마크업을 그대로 옮기고 실제 BadgeRow 를 넣어
 * 접힘/펼침(hover) 상태의 높이·배지 줄바꿈·면책 문구 위치를 본다.
 *
 * 사용: `npm run dev` 후 http://localhost:3090/toolbar-harness.html
 */
import 'regenerator-runtime/runtime';
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RecoilRoot } from 'recoil';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Paperclip, Mic, ArrowUp } from 'lucide-react';
import { TextareaAutosize } from '@librechat/client';
import { useForm } from 'react-hook-form';
import { ChatFormProvider } from '~/Providers';
import { AuthContext } from '~/hooks/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import type { ChatFormValues } from '~/common';
import '../locales/i18n';
import '../style.css';
import BadgeRow from '~/components/Chat/Input/BadgeRow';
import { CollapsibleToolbar, AiDisclaimer } from '~/components/Chat/Input/BklCompactToolbar';
import { cn } from '~/utils';
import useTextareaWidthResize from '~/hooks/Input/useTextareaWidthResize';

function InputBox({
  isInChat,
  forceCompact,
  width,
}: {
  isInChat: boolean;
  forceCompact: boolean | null;
  width: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [toolbarFocused, setToolbarFocused] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  // ChatForm 과 동일: 폭이 바뀌면 높이 재계산 (좁을 때 잰 높이가 남지 않게)
  useTextareaWidthResize(textAreaRef);
  // ChatForm: isToolbarCompact = isInChat && hoverCapable && !hovered && !focused ...
  const compact = forceCompact ?? (isInChat && !hovered && !toolbarFocused);

  const sendControl = (
    <button
      type="button"
      className="rounded-full bg-text-primary p-1.5 text-text-primary opacity-10"
      disabled
    >
      <ArrowUp size={24} className="text-white" />
    </button>
  );

  const toolbarRow = (
    <div
      className={cn('@container items-between relative flex flex-row items-center gap-2 pb-2')}
      onFocus={() => setToolbarFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setToolbarFocused(false);
        }
      }}
    >
      <div className="ml-2">
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-full p-1 hover:bg-surface-hover"
        >
          <Paperclip className="h-5 w-5" />
        </button>
      </div>
      <BadgeRow
        showEphemeralBadges
        isSubmitting={false}
        conversationId={isInChat ? 'c1' : 'new'}
        specName={undefined}
        onChange={() => undefined}
        isInChat={isInChat}
      />
      <div className="mx-auto flex" />
      <button
        type="button"
        className="flex size-9 items-center justify-center rounded-full p-1 hover:bg-surface-hover"
      >
        <Mic className="h-5 w-5" />
      </button>
      {!isInChat && <div className="mr-2">{sendControl}</div>}
    </div>
  );

  return (
    <div
      className="relative flex flex-col items-stretch"
      style={{ width }}
      data-testid={`box-${isInChat ? 'chat' : 'landing'}`}
    >
      <div className="flex w-full flex-col">
        <div
          data-testid="box"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={cn(
            'relative flex w-full flex-grow flex-col overflow-hidden rounded-3xl border border-border-light bg-surface-chat text-text-primary shadow-md transition-all duration-200',
          )}
        >
          <div className="flex flex-row">
            <div className="relative flex-1">
              <TextareaAutosize
                ref={textAreaRef}
                rows={1}
                aria-label="메시지 BKL Prism"
                placeholder={isInChat ? '답글' : '메시지 BKL Prism'}
                data-testid="text-input"
                className="scrollbar-hover m-0 block w-full resize-none bg-transparent px-5 py-[13px] placeholder-black/60 outline-none transition-[max-height] duration-200 md:py-3.5"
                style={{ height: 44, overflowY: 'auto' }}
              />
            </div>
            {isInChat && (
              <div className="flex items-end pr-2">
                <div className="flex h-[50px] items-center md:h-[52px]">{sendControl}</div>
              </div>
            )}
          </div>
          {isInChat ? (
            <CollapsibleToolbar compact={compact}>{toolbarRow}</CollapsibleToolbar>
          ) : (
            toolbarRow
          )}
        </div>
        {isInChat && <AiDisclaimer />}
      </div>
      <p className="mt-1 text-center font-mono text-[10px] text-text-secondary">
        {isInChat ? 'chat' : 'landing'} · compact={String(compact)} · hovered={String(hovered)}
      </p>
    </div>
  );
}

function App() {
  const [force, setForce] = useState<boolean | null>(null);
  const [width, setWidth] = useState(768);
  const methods = useForm<ChatFormValues>({ defaultValues: { text: '' } });
  return (
    <ChatFormProvider {...methods}>
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-4 font-mono text-sm">BklCompactToolbar harness</h1>
        <div className="mb-6 flex items-center gap-4 font-mono text-xs">
          <label>
            force:{' '}
            <select
              value={force === null ? 'auto' : String(force)}
              onChange={(e) =>
                setForce(e.target.value === 'auto' ? null : e.target.value === 'true')
              }
            >
              <option value="auto">auto (hover)</option>
              <option value="true">compact</option>
              <option value="false">expanded</option>
            </select>
          </label>
          <label>
            width:{' '}
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-20 border px-1"
            />
          </label>
        </div>
        <h2 className="mb-2 font-mono text-xs text-text-secondary">1. 대화 중 (isInChat)</h2>
        <InputBox isInChat forceCompact={force} width={width} />
        <h2 className="mb-2 mt-10 font-mono text-xs text-text-secondary">
          2. 대기화면 (항상 펼침, 기존과 동일)
        </h2>
        <InputBox isInChat={false} forceCompact={null} width={width} />
      </div>
    </ChatFormProvider>
  );
}

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const fakeAuth: any = {
  user: { id: 'u1', role: 'ADMIN', name: 'dev' },
  token: 'dev',
  isAuthenticated: true,
  roles: {},
  error: undefined,
  login: () => undefined,
  logout: () => undefined,
  setError: () => undefined,
};
createRoot(document.getElementById('root')!).render(
  <RecoilRoot>
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthContext.Provider value={fakeAuth}>
          <App />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  </RecoilRoot>,
);
