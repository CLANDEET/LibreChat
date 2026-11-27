import React, { useState, useMemo, memo } from 'react';
import type { TConversation, TMessage, TFeedback } from 'librechat-data-provider';
import { Clipboard, CheckMark } from '@librechat/client';
import { useLocalize } from '~/hooks';
import GuidedRetryInput from './GuidedRetryInput';
import Feedback from './Feedback';
import { cn } from '~/utils';

type THoverButtons = {
  isEditing: boolean;
  enterEdit: (cancel?: boolean) => void;
  copyToClipboard: (setIsCopied: React.Dispatch<React.SetStateAction<boolean>>) => void;
  conversation: TConversation | null;
  isSubmitting: boolean;
  message: TMessage;
  regenerate: () => void;
  handleContinue: (e: React.MouseEvent<HTMLButtonElement>) => void;
  latestMessageId?: string;
  isLast: boolean;
  index: number;
  handleFeedback?: ({ feedback }: { feedback: TFeedback | undefined }) => void;
};

type HoverButtonProps = {
  id?: string;
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  title: string;
  icon: React.ReactNode;
  isActive?: boolean;
  isVisible?: boolean;
  isDisabled?: boolean;
  isLast?: boolean;
  className?: string;
  buttonStyle?: string;
};

const HoverButton = memo(
  ({
    id,
    onClick,
    title,
    icon,
    isActive = false,
    isVisible = true,
    isDisabled = false,
    isLast = false,
    className = '',
  }: HoverButtonProps) => {
    const buttonStyle = cn(
      'hover-button rounded-lg p-1.5 text-text-secondary-alt',
      'hover:text-text-primary hover:bg-surface-hover',
      'md:group-hover:visible md:group-focus-within:visible md:group-[.final-completion]:visible',
      !isLast && 'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
      !isVisible && 'opacity-0',
      'focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:outline-none',
      isActive && isVisible && 'active text-text-primary bg-surface-hover',
      className,
    );

    return (
      <button
        id={id}
        className={buttonStyle}
        onClick={onClick}
        type="button"
        title={title}
        disabled={isDisabled}
      >
        {icon}
      </button>
    );
  },
);

HoverButton.displayName = 'HoverButton';

function extractBklRid(message: TMessage): string | null {
  const RID_RE = /<!-- bkl_rid:([a-zA-Z0-9_-]+) -->/;
  const fromText = message.text?.match(RID_RE)?.[1];
  if (fromText) return fromText;
  if (!Array.isArray(message.content)) return null;
  for (const part of message.content) {
    if (part?.type !== 'text') continue;
    const raw = (part as Record<string, unknown>).text;
    const textValue = typeof raw === 'string' ? raw : (raw as { value?: string } | null)?.value;
    if (!textValue) continue;
    const fromContent = textValue.match(RID_RE)?.[1];
    if (fromContent) return fromContent;
  }
  return null;
}

const SearchRetryIcon = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
);

const HoverButtons = ({
  copyToClipboard,
  conversation,
  isSubmitting,
  message,
  isLast,
  handleFeedback,
}: THoverButtons) => {
  const localize = useLocalize();
  const [isCopied, setIsCopied] = useState(false);
  const [showGuidedRetry, setShowGuidedRetry] = useState(false);

  const bklRid = useMemo(() => extractBklRid(message), [message]);

  if (!conversation) {
    return null;
  }

  const { isCreatedByUser, error } = message;

  // BKL: 오류 답변에는 재생성만 있었는데 재생성도 뺐으므로 아무것도 표시하지 않는다.
  if (error === true) {
    return null;
  }

  const handleCopy = () => copyToClipboard(setIsCopied);

  return (
    <div className="relative">
      <div className="group visible flex justify-center gap-0.5 self-end focus-within:outline-none lg:justify-start">
        {/* BKL: 읽어주기(TTS)·편집·포크·재생성·계속 버튼 제거 (2026-11-27).
            Prism 에서 쓰지 않는 기능들. 남는 것: 복사 · 👍👎 · 검색 보완하기. */}

        {/* Copy Button */}
        <HoverButton
          onClick={handleCopy}
          title={
            isCopied ? localize('com_ui_copied_to_clipboard') : localize('com_ui_copy_to_clipboard')
          }
          icon={isCopied ? <CheckMark className="h-[18px] w-[18px]" /> : <Clipboard size="19" />}
          isLast={isLast}
          className={cn(
            'ml-0 flex items-center gap-1.5 text-xs',
            isSubmitting && isCreatedByUser ? 'md:opacity-0 md:group-hover:opacity-100' : '',
          )}
        />

        {/* Feedback Buttons */}
        {!isCreatedByUser && handleFeedback != null && (
          <Feedback handleFeedback={handleFeedback} feedback={message.feedback} isLast={isLast} />
        )}

        {/* Guided Retry Button (only for assistant messages with RAG results) */}
        {!isCreatedByUser && bklRid && (
          <HoverButton
            onClick={() => setShowGuidedRetry((prev) => !prev)}
            title="검색 보완하기"
            icon={<SearchRetryIcon />}
            isActive={showGuidedRetry}
            isLast={isLast}
            className={showGuidedRetry ? 'text-green-500' : ''}
          />
        )}
      </div>

      {/* Guided Retry Input - rendered as dropdown below the button row */}
      {showGuidedRetry && bklRid && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[420px]">
          <GuidedRetryInput bklRid={bklRid} onClose={() => setShowGuidedRetry(false)} />
        </div>
      )}
    </div>
  );
};

export default memo(HoverButtons);
