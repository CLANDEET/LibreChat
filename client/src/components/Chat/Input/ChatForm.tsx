import { memo, useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useWatch } from 'react-hook-form';
import { TextareaAutosize } from '@librechat/client';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Constants, isAssistantsEndpoint, isAgentsEndpoint } from 'librechat-data-provider';
import {
  useChatContext,
  useChatFormContext,
  useAddedChatContext,
  useAssistantsMapContext,
} from '~/Providers';
import {
  useTextarea,
  useAutoSave,
  useLocalize,
  useRequiresKey,
  useHandleKeyUp,
  useQueryParams,
  useSubmitMessage,
  useFocusChatEffect,
  useTextareaWidthResize,
} from '~/hooks';
import { mainTextareaId, BadgeItem } from '~/common';
import AttachFileChat from './Files/AttachFileChat';
import FileFormChat from './Files/FileFormChat';
import { cn, forceResize, removeFocusRings } from '~/utils';
import { CollapsibleToolbar, AiDisclaimer } from './BklCompactToolbar';
import { parseBklQueryChoices } from '~/utils/bklFilter';
import QueryChoicesPanel from '../Messages/Content/QueryChoicesPanel';
import BklMatterMention from './BklMatterMention';
import BklMatterChips from './BklMatterChips';
import BklActiveFilterChips from './BklActiveFilterChips';
import TextareaHeader from './TextareaHeader';
import PromptsCommand from './PromptsCommand';
import AudioRecorder from './AudioRecorder';
import CollapseChat from './CollapseChat';
import StreamAudio from './StreamAudio';
import StopButton from './StopButton';
import SendButton from './SendButton';
import EditBadges from './EditBadges';
import BadgeRow from './BadgeRow';
import Mention from './Mention';
import store from '~/store';

const ChatForm = memo(({ index = 0 }: { index?: number }) => {
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  useFocusChatEffect(textAreaRef);
  const localize = useLocalize();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [, setIsScrollable] = useState(false);
  const [visualRowCount, setVisualRowCount] = useState(1);
  const [isTextAreaFocused, setIsTextAreaFocused] = useState(false);
  const [backupBadges, setBackupBadges] = useState<Pick<BadgeItem, 'id'>[]>([]);
  const [isFormHovered, setIsFormHovered] = useState(false);
  const [isToolbarFocused, setIsToolbarFocused] = useState(false);

  const SpeechToText = useRecoilValue(store.speechToText);
  const TextToSpeech = useRecoilValue(store.textToSpeech);
  const chatDirection = useRecoilValue(store.chatDirection);
  const automaticPlayback = useRecoilValue(store.automaticPlayback);
  const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);
  const isTemporary = useRecoilValue(store.isTemporary);

  const [badges, setBadges] = useRecoilState(store.chatBadges);
  const [isEditingBadges, setIsEditingBadges] = useRecoilState(store.isEditingBadges);
  const [showStopButton, setShowStopButton] = useRecoilState(store.showStopButtonByIndex(index));
  const [showPlusPopover, setShowPlusPopover] = useRecoilState(store.showPlusPopoverFamily(index));
  const [showMentionPopover, setShowMentionPopover] = useRecoilState(
    store.showMentionPopoverFamily(index),
  );

  const { requiresKey } = useRequiresKey();
  const methods = useChatFormContext();
  const { files, setFiles, conversation, isSubmitting, filesLoading, handleStopGenerating } =
    useChatContext();
  const {
    generateConversation,
    conversation: addedConvo,
    setConversation: setAddedConvo,
  } = useAddedChatContext();
  const assistantMap = useAssistantsMapContext();

  const endpoint = useMemo(
    () => conversation?.endpointType ?? conversation?.endpoint,
    [conversation?.endpointType, conversation?.endpoint],
  );
  const conversationId = useMemo(
    () => conversation?.conversationId ?? Constants.NEW_CONVO,
    [conversation?.conversationId],
  );
  const previousConversationIdRef = useRef(conversationId);

  const isRTL = useMemo(
    () => (chatDirection != null ? chatDirection?.toLowerCase() === 'rtl' : false),
    [chatDirection],
  );
  const invalidAssistant = useMemo(
    () =>
      isAssistantsEndpoint(endpoint) &&
      (!(conversation?.assistant_id ?? '') ||
        !assistantMap?.[endpoint ?? '']?.[conversation?.assistant_id ?? '']),
    [conversation?.assistant_id, endpoint, assistantMap],
  );
  const disableInputs = useMemo(
    () => requiresKey || invalidAssistant,
    [requiresKey, invalidAssistant],
  );

  const handleContainerClick = useCallback(() => {
    /** Check if the device is a touchscreen */
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      return;
    }
    textAreaRef.current?.focus();
  }, []);

  const handleFocusOrClick = useCallback(() => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  }, [isCollapsed]);

  useAutoSave({
    files,
    setFiles,
    textAreaRef,
    conversationId,
    isSubmitting,
  });

  const { submitMessage, submitPrompt } = useSubmitMessage();
  const latestMessage = useRecoilValue(store.latestMessageFamily(index));
  const queryChoicesPayload = useMemo(() => {
    if (!latestMessage || latestMessage.isCreatedByUser) return null;
    const directText = (latestMessage.text ?? '') as string;
    if (directText.startsWith('[BKL_QUERY_CHOICES:')) {
      const payload = parseBklQueryChoices(directText);
      if (payload) return payload;
    }
    const parts = (latestMessage as any).content;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        const value = typeof part?.text === 'string' ? part.text : (part?.text?.value ?? '');
        if (value.startsWith('[BKL_QUERY_CHOICES:')) {
          const payload = parseBklQueryChoices(value);
          if (payload) return payload;
        }
      }
    }
    return null;
  }, [latestMessage]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (detail?.text) {
        submitMessage({ text: detail.text });
      }
    };
    window.addEventListener('bkl-guided-retry', handler);
    return () => window.removeEventListener('bkl-guided-retry', handler);
  }, [submitMessage]);

  const handleKeyUp = useHandleKeyUp({
    index,
    textAreaRef,
    setShowPlusPopover,
    setShowMentionPopover,
  });
  const {
    isNotAppendable,
    handlePaste,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  } = useTextarea({
    textAreaRef,
    submitButtonRef,
    setIsScrollable,
    disabled: disableInputs,
  });

  useQueryParams({ textAreaRef });

  useEffect(() => {
    if (previousConversationIdRef.current === conversationId) {
      return;
    }

    previousConversationIdRef.current = conversationId;
    if (isSubmitting) {
      return;
    }

    methods.reset({ text: '' });
    if (textAreaRef.current) {
      textAreaRef.current.value = '';
    }
    setVisualRowCount(1);
    setIsCollapsed(false);
    // 대화 전환 직후 우측 패널이 열리며 레이아웃이 요동치는 동안 잰 높이가 남지
    // 않도록, 레이아웃이 가라앉은 뒤 실제 scrollHeight 로 한 번 더 맞춘다.
    const timer = window.setTimeout(() => forceResize(textAreaRef.current), 400);
    return () => window.clearTimeout(timer);
  }, [conversationId, isSubmitting, methods]);

  // 폭이 바뀔 때마다(패널 열림/리사이즈) 높이 재계산 — 상세는 훅 주석.
  useTextareaWidthResize(textAreaRef, [endpoint]);

  const { ref, ...registerProps } = methods.register('text', {
    required: true,
    onChange: useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) =>
        methods.setValue('text', e.target.value, { shouldValidate: true }),
      [methods],
    ),
  });

  const textValue = useWatch({ control: methods.control, name: 'text' });

  useEffect(() => {
    if (textAreaRef.current) {
      const style = window.getComputedStyle(textAreaRef.current);
      const lineHeight = parseFloat(style.lineHeight);
      setVisualRowCount(Math.floor(textAreaRef.current.scrollHeight / lineHeight));
    }
  }, [textValue]);

  useEffect(() => {
    if (isEditingBadges && backupBadges.length === 0) {
      setBackupBadges([...badges]);
    }
  }, [isEditingBadges, badges, backupBadges.length]);

  const handleSaveBadges = useCallback(() => {
    setIsEditingBadges(false);
    setBackupBadges([]);
  }, [setIsEditingBadges, setBackupBadges]);

  const handleCancelBadges = useCallback(() => {
    if (backupBadges.length > 0) {
      setBadges([...backupBadges]);
    }
    setIsEditingBadges(false);
    setBackupBadges([]);
  }, [backupBadges, setBadges, setIsEditingBadges]);

  const isMoreThanThreeRows = visualRowCount > 3;

  // "대화 중" 은 라우트 기준으로 즉시 판정한다 (기존 대화 URL 이면 메시지가 아직
  // 로딩 중이어도 true). 메시지 개수만 보면 사이드바에서 대화를 열 때 대기화면
  // 레이아웃(큰 박스)이 먼저 그려졌다가 줄어드는 깜빡임이 생긴다. 새 대화에서 첫
  // 메시지를 보낸 직후(아직 conversationId 가 'new')는 메시지 개수로 잡는다.
  const isInChat =
    conversationId !== Constants.NEW_CONVO ||
    (Array.isArray(conversation?.messages) && conversation.messages.length >= 1);
  // 대화 중 입력창 박스는 기본 **텍스트 한 줄 + 전송 버튼**. 마우스를 올리면(hover)
  // 박스 안 두 번째 줄(첨부·필터·검색·쿼리 강화·마이크)이 펼쳐져 대기화면과 같은
  // 두 줄이 된다. 키보드로 도구줄에 들어오거나(focus-within) 파일 첨부·배지 편집
  // 중이면 펼친 채 유지. hover 가 없는 터치 기기에서는 항상 펼친 상태.
  // "Prism은 AI이므로…" 면책 문구는 박스 **바깥** 아래 한 줄.
  const hoverCapable = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover)').matches,
    [],
  );
  const isToolbarCompact =
    isInChat &&
    hoverCapable &&
    !isFormHovered &&
    !isToolbarFocused &&
    !isEditingBadges &&
    files.size === 0;

  const baseClasses = useMemo(
    () =>
      cn(
        'md:py-3.5 m-0 w-full resize-none py-[13px] placeholder-black/60 bg-transparent dark:placeholder-white/60 [&:has(textarea:focus)]:shadow-[0_2px_6px_rgba(0,0,0,.05)]',
        isCollapsed ? 'max-h-[52px]' : 'max-h-[45vh] md:max-h-[55vh]',
        isMoreThanThreeRows ? 'pl-5' : 'px-5',
      ),
    [isCollapsed, isMoreThanThreeRows],
  );

  const sendControl =
    isSubmitting && showStopButton ? (
      <StopButton stop={handleStopGenerating} setShowStopButton={setShowStopButton} />
    ) : (
      endpoint && (
        <SendButton
          ref={submitButtonRef}
          control={methods.control}
          disabled={filesLoading || isSubmitting || disableInputs || isNotAppendable}
        />
      )
    );

  // 첨부 · 배지(필터/검색/쿼리 강화) · 마이크 (· 전송) 도구줄 — 박스 안 마지막 줄.
  // 대화 중에는 전송 버튼이 텍스트 줄로 올라가고, 이 줄은 hover 시에만 펼쳐진다.
  const toolbarRow = (
    <div
      className={cn(
        '@container items-between relative flex items-center gap-2 pb-2',
        isRTL ? 'flex-row-reverse' : 'flex-row',
      )}
      data-testid="bkl-chat-toolbar"
      onFocus={() => setIsToolbarFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsToolbarFocused(false);
        }
      }}
    >
      <div className={`${isRTL ? 'mr-2' : 'ml-2'}`}>
        <AttachFileChat conversation={conversation} disableInputs={disableInputs} />
      </div>
      <BadgeRow
        showEphemeralBadges={
          !!endpoint && !isAgentsEndpoint(endpoint) && !isAssistantsEndpoint(endpoint)
        }
        isSubmitting={isSubmitting}
        conversationId={conversationId}
        specName={conversation?.spec}
        onChange={setBadges}
        isInChat={isInChat}
      />
      <div className="mx-auto flex" />
      {SpeechToText && (
        <AudioRecorder
          methods={methods}
          ask={submitMessage}
          textAreaRef={textAreaRef}
          disabled={disableInputs || isNotAppendable}
          isSubmitting={isSubmitting}
        />
      )}
      {!isInChat && <div className={`${isRTL ? 'ml-2' : 'mr-2'}`}>{sendControl}</div>}
    </div>
  );

  if (queryChoicesPayload) {
    return (
      <div
        className={cn(
          'mx-auto flex w-full flex-row gap-3 transition-[max-width] duration-300 sm:mb-16 sm:px-2',
          maximizeChatSpace ? 'max-w-full' : 'md:max-w-3xl xl:max-w-4xl',
        )}
      >
        <QueryChoicesPanel
          payload={queryChoicesPayload}
          isSubmitting={isSubmitting}
          onSubmit={(query) => submitMessage({ text: query })}
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={methods.handleSubmit(submitMessage)}
      className={cn(
        'mx-auto flex w-full flex-row gap-3 transition-[max-width] duration-300 sm:px-2',
        maximizeChatSpace ? 'max-w-full' : 'md:max-w-3xl xl:max-w-4xl',
        centerFormOnLanding &&
          (conversationId == null || conversationId === Constants.NEW_CONVO) &&
          !isSubmitting &&
          conversation?.messages?.length === 0
          ? 'transition-all duration-200 sm:mb-28'
          : // 대화 중에는 버전 푸터를 내리지 않는다(대기화면에만) — 면책 문구가
            // 입력창 도구줄 안으로 들어갔으므로 아래 여백은 얇게.
            'sm:mb-4',
      )}
    >
      <div className="relative flex h-full flex-1 items-stretch md:flex-col">
        <div className="flex w-full flex-col">
          <div className={cn('flex w-full items-center', isRTL && 'flex-row-reverse')}>
            {showPlusPopover && !isAssistantsEndpoint(endpoint) && (
              <Mention
                setShowMentionPopover={setShowPlusPopover}
                newConversation={generateConversation}
                textAreaRef={textAreaRef}
                commandChar="+"
                placeholder="com_ui_add_model_preset"
                includeAssistants={false}
              />
            )}
            {showMentionPopover && (
              <BklMatterMention
                setShowMentionPopover={setShowMentionPopover}
                textAreaRef={textAreaRef}
              />
            )}
            <PromptsCommand index={index} textAreaRef={textAreaRef} submitPrompt={submitPrompt} />
            <div
              onClick={handleContainerClick}
              onMouseEnter={() => setIsFormHovered(true)}
              onMouseLeave={() => setIsFormHovered(false)}
              className={cn(
                'relative flex w-full flex-grow flex-col overflow-hidden rounded-t-3xl border pb-4 text-text-primary transition-all duration-200 sm:rounded-3xl sm:pb-0',
                isTextAreaFocused ? 'shadow-lg' : 'shadow-md',
                isTemporary
                  ? 'border-violet-800/60 bg-violet-950/10'
                  : 'border-border-light bg-surface-chat',
              )}
            >
              <TextareaHeader addedConvo={addedConvo} setAddedConvo={setAddedConvo} />
              <BklMatterChips />
              <BklActiveFilterChips />
              {/* WIP */}
              <EditBadges
                isEditingChatBadges={isEditingBadges}
                handleCancelBadges={handleCancelBadges}
                handleSaveBadges={handleSaveBadges}
                setBadges={setBadges}
              />
              <FileFormChat conversation={conversation} />
              {endpoint && (
                <div className={cn('flex', isRTL ? 'flex-row-reverse' : 'flex-row')}>
                  <div
                    className="relative flex-1"
                    style={
                      isCollapsed
                        ? {
                            WebkitMaskImage:
                              'linear-gradient(to bottom, black 60%, transparent 90%)',
                            maskImage: 'linear-gradient(to bottom, black 60%, transparent 90%)',
                          }
                        : undefined
                    }
                  >
                    <TextareaAutosize
                      {...registerProps}
                      ref={(e) => {
                        ref(e);
                        (
                          textAreaRef as React.MutableRefObject<HTMLTextAreaElement | null>
                        ).current = e;
                      }}
                      disabled={disableInputs || isNotAppendable}
                      onPaste={handlePaste}
                      onKeyDown={handleKeyDown}
                      onKeyUp={handleKeyUp}
                      onCompositionStart={handleCompositionStart}
                      onCompositionEnd={handleCompositionEnd}
                      id={mainTextareaId}
                      tabIndex={0}
                      data-testid="text-input"
                      rows={1}
                      onFocus={() => {
                        handleFocusOrClick();
                        setIsTextAreaFocused(true);
                      }}
                      onBlur={setIsTextAreaFocused.bind(null, false)}
                      aria-label={localize('com_ui_message_input')}
                      onClick={handleFocusOrClick}
                      style={{ height: 44, overflowY: 'auto' }}
                      className={cn(
                        baseClasses,
                        removeFocusRings,
                        'scrollbar-hover transition-[max-height] duration-200 disabled:cursor-not-allowed',
                      )}
                    />
                  </div>
                  <div className="flex flex-col items-start justify-start pr-2.5 pt-1.5">
                    <CollapseChat
                      isCollapsed={isCollapsed}
                      isScrollable={isMoreThanThreeRows}
                      setIsCollapsed={setIsCollapsed}
                    />
                  </div>
                  {isInChat && (
                    <div className={cn('flex items-end pb-2', isRTL ? 'pl-2' : 'pr-2')}>
                      {sendControl}
                    </div>
                  )}
                </div>
              )}
              {isInChat ? (
                <CollapsibleToolbar compact={isToolbarCompact}>{toolbarRow}</CollapsibleToolbar>
              ) : (
                toolbarRow
              )}
              {TextToSpeech && automaticPlayback && <StreamAudio index={index} />}
            </div>
          </div>
          {isInChat && <AiDisclaimer />}
        </div>
      </div>
    </form>
  );
});

export default ChatForm;
