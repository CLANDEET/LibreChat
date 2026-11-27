import React, { useState, useMemo, memo } from 'react';
import type { TConversation, TMessage, TFeedback } from 'librechat-data-provider';
import { EditIcon, Clipboard, CheckMark, ContinueIcon, RegenerateIcon } from '@librechat/client';
import { useGenerationsByLatest, useLocalize } from '~/hooks';
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
  isEditing,
  enterEdit,
  copyToClipboard,
  conversation,
  isSubmitting,
  message,
  regenerate,
  handleContinue,
  latestMessageId,
  isLast,
  handleFeedback,
}: THoverButtons) => {
  const localize = useLocalize();
  const [isCopied, setIsCopied] = useState(false);
  const [showGuidedRetry, setShowGuidedRetry] = useState(false);

  const bklRid = useMemo(() => extractBklRid(message), [message]);

  const endpoint = useMemo(() => {
    if (!conversation) {
      return '';
    }
    return conversation.endpointType ?? conversation.endpoint;
  }, [conversation]);

  const generationCapabilities = useGenerationsByLatest({
    isEditing,
    isSubmitting,
    error: message.error,
    endpoint: endpoint ?? '',
    messageId: message.messageId,
    searchResult: message.searchResult,
    finish_reason: message.finish_reason,
    isCreatedByUser: message.isCreatedByUser,
    latestMessageId: latestMessageId,
  });

  const { hideEditButton, regenerateEnabled, continueSupported, isEditableEndpoint } =
    generationCapabilities;

  if (!conversation) {
    return null;
  }

  const { isCreatedByUser, error } = message;

  if (error === true) {
    return (
      <div className="visible flex justify-center self-end lg:justify-start">
        {regenerateEnabled && (
          <HoverButton
            onClick={regenerate}
            title={localize('com_ui_regenerate')}
            icon={<RegenerateIcon size="19" />}
            isLast={isLast}
          />
        )}
      </div>
    );
  }

  const onEdit = () => {
    if (isEditing) {
      return enterEdit(true);
    }
    enterEdit();
  };

  const handleCopy = () => copyToClipboard(setIsCopied);

  return (
    <div className="relative">
      <div className="group visible flex justify-center gap-0.5 self-end focus-within:outline-none lg:justify-start">
        {/* BKL: 읽어주기(TTS)·포크 버튼 제거, 편집은 내 질문에만.
            Prism 은 음성 기능을 지원하지 않고(설정 메뉴도 없어 끌 수 없음), 대화 포크는
            법률 Q&A 에서 혼란만 주며, AI 답변 본문 편집은 기록을 바꾸는 기능이라 뺐다.
            남는 것: 복사 · 편집(내 질문) · 👍👎 · 검색 보완하기 · 재생성 · 계속(잘린 답변만). */}

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

        {/* Edit Button — 내 질문만 (질문 수정 후 재전송) */}
        {isCreatedByUser && isEditableEndpoint && (
          <HoverButton
            id={`edit-${message.messageId}`}
            onClick={onEdit}
            title={localize('com_ui_edit')}
            icon={<EditIcon size="19" />}
            isActive={isEditing}
            isVisible={!hideEditButton}
            isDisabled={hideEditButton}
            isLast={isLast}
            className={isCreatedByUser ? '' : 'active'}
          />
        )}

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

        {/* Regenerate Button */}
        {regenerateEnabled && (
          <HoverButton
            onClick={regenerate}
            title={localize('com_ui_regenerate')}
            icon={<RegenerateIcon size="19" />}
            isLast={isLast}
            className="active"
          />
        )}

        {/* Continue Button */}
        {continueSupported && (
          <HoverButton
            onClick={(e) => e && handleContinue(e)}
            title={localize('com_ui_continue')}
            icon={<ContinueIcon className="w-19 h-19 -rotate-180" />}
            isLast={isLast}
            className="active"
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
