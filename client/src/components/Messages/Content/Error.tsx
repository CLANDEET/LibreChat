// file deepcode ignore HardcodedNonCryptoSecret: No hardcoded secrets
import { useState } from 'react';
import { ViolationTypes, ErrorTypes, alternateName } from 'librechat-data-provider';
import type { LocalizeFunction } from '~/common';
import { formatJSON, extractJson, isJson } from '~/utils/json';
import { useLocalize } from '~/hooks';
import { classifyBklError, type BklClassifiedError } from '~/utils/bklErrors';
import CodeBlock from './CodeBlock';

const localizedErrorPrefix = 'com_error';

type TConcurrent = {
  limit: number;
};

type TMessageLimit = {
  max: number;
  windowInMinutes: number;
};

type TTokenBalance = {
  type: ViolationTypes | ErrorTypes;
  balance: number;
  tokenCost: number;
  promptTokens: number;
  prev_count: number;
  violation_count: number;
  date: Date;
  generations?: unknown[];
};

type TExpiredKey = {
  expiredAt: string;
  endpoint: string;
};

type TGenericError = {
  info: string;
};

const errorMessages = {
  [ErrorTypes.MODERATION]: 'com_error_moderation',
  [ErrorTypes.NO_USER_KEY]: 'com_error_no_user_key',
  [ErrorTypes.INVALID_USER_KEY]: 'com_error_invalid_user_key',
  [ErrorTypes.NO_BASE_URL]: 'com_error_no_base_url',
  [ErrorTypes.INVALID_ACTION]: `com_error_${ErrorTypes.INVALID_ACTION}`,
  [ErrorTypes.INVALID_REQUEST]: `com_error_${ErrorTypes.INVALID_REQUEST}`,
  [ErrorTypes.REFUSAL]: 'com_error_refusal',
  [ErrorTypes.MISSING_MODEL]: (json: TGenericError, localize: LocalizeFunction) => {
    const { info: endpoint } = json;
    const provider = (alternateName[endpoint ?? ''] as string | undefined) ?? endpoint ?? 'unknown';
    return localize('com_error_missing_model', { 0: provider });
  },
  [ErrorTypes.MODELS_NOT_LOADED]: 'com_error_models_not_loaded',
  [ErrorTypes.ENDPOINT_MODELS_NOT_LOADED]: (json: TGenericError, localize: LocalizeFunction) => {
    const { info: endpoint } = json;
    const provider = (alternateName[endpoint ?? ''] as string | undefined) ?? endpoint ?? 'unknown';
    return localize('com_error_endpoint_models_not_loaded', { 0: provider });
  },
  [ErrorTypes.NO_SYSTEM_MESSAGES]: `com_error_${ErrorTypes.NO_SYSTEM_MESSAGES}`,
  [ErrorTypes.EXPIRED_USER_KEY]: (json: TExpiredKey, localize: LocalizeFunction) => {
    const { expiredAt, endpoint } = json;
    return localize('com_error_expired_user_key', { 0: endpoint, 1: expiredAt });
  },
  [ErrorTypes.INPUT_LENGTH]: (json: TGenericError, localize: LocalizeFunction) => {
    const { info } = json;
    return localize('com_error_input_length', { 0: info });
  },
  [ErrorTypes.INVALID_AGENT_PROVIDER]: (json: TGenericError, localize: LocalizeFunction) => {
    const { info } = json;
    const provider = (alternateName[info] as string | undefined) ?? info;
    return localize('com_error_invalid_agent_provider', { 0: provider });
  },
  [ErrorTypes.GOOGLE_ERROR]: (json: TGenericError) => {
    const { info } = json;
    return info;
  },
  [ErrorTypes.GOOGLE_TOOL_CONFLICT]: 'com_error_google_tool_conflict',
  [ViolationTypes.BAN]:
    'Your account has been temporarily banned due to violations of our service.',
  [ViolationTypes.ILLEGAL_MODEL_REQUEST]: (json: TGenericError, localize: LocalizeFunction) => {
    const { info } = json;
    const [endpoint, model = 'unknown'] = info?.split('|') ?? [];
    const provider = (alternateName[endpoint ?? ''] as string | undefined) ?? endpoint ?? 'unknown';
    return localize('com_error_illegal_model_request', { 0: model, 1: provider });
  },
  invalid_api_key:
    'Invalid API key. Please check your API key and try again. You can do this by clicking on the model logo in the left corner of the textbox and selecting "Set Token" for the current selected endpoint. Thank you for your understanding.',
  insufficient_quota:
    'We apologize for any inconvenience caused. The default API key has reached its limit. To continue using this service, please set up your own API key. You can do this by clicking on the model logo in the left corner of the textbox and selecting "Set Token" for the current selected endpoint. Thank you for your understanding.',
  concurrent: (json: TConcurrent) => {
    const { limit } = json;
    const plural = limit > 1 ? 's' : '';
    return `Only ${limit} message${plural} at a time. Please allow any other responses to complete before sending another message, or wait one minute.`;
  },
  message_limit: (json: TMessageLimit) => {
    const { max, windowInMinutes } = json;
    const plural = max > 1 ? 's' : '';
    return `You hit the message limit. You have a cap of ${max} message${plural} per ${
      windowInMinutes > 1 ? `${windowInMinutes} minutes` : 'minute'
    }.`;
  },
  token_balance: (json: TTokenBalance) => {
    const { balance, tokenCost, promptTokens, generations } = json;
    const message = `Insufficient Funds! Balance: ${balance}. Prompt tokens: ${promptTokens}. Cost: ${tokenCost}.`;
    return (
      <>
        {message}
        {generations && (
          <>
            <br />
            <br />
          </>
        )}
        {generations && (
          <CodeBlock
            lang="Generations"
            error={true}
            codeChildren={formatJSON(JSON.stringify(generations))}
          />
        )}
      </>
    );
  },
};

/**
 * BKL: 유형화된 한글 오류 안내 — raw `502 Bad Gateway` / 내부 메시지 대신
 * 코드표(utils/bklErrors) 의 제목·안내문 + 요청 ID 를 보여준다. 원문은
 * "자세히" 토글 뒤에 둔다 (관리자 문의 시 복사용).
 */
export function BklErrorNotice({ error }: { error: BklClassifiedError }) {
  const [showRaw, setShowRaw] = useState(false);
  const { spec, requestId, raw } = error;
  return (
    <div data-testid="bkl-error-notice" data-code={spec.code} className="flex flex-col gap-1">
      <div className="font-semibold">{spec.title}</div>
      <div>{spec.message}</div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-80">
        <span>
          오류 코드: <code>{spec.code}</code>
        </span>
        {requestId ? (
          <span>
            요청 ID: <code data-testid="bkl-error-rid">{requestId}</code>
          </span>
        ) : null}
        {raw ? (
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="underline underline-offset-2 hover:opacity-100"
          >
            {showRaw ? '원문 숨기기' : '자세히'}
          </button>
        ) : null}
      </div>
      {showRaw && raw ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-black/5 p-2 text-[11px] dark:bg-white/5">
          {raw.length > 1200 ? raw.slice(0, 1200) + '…' : raw}
        </pre>
      ) : null}
    </div>
  );
}

const Error = ({ text }: { text: string }) => {
  const localize = useLocalize();
  const jsonString = extractJson(text);

  if (!isJson(jsonString)) {
    // BKL: 마커 `[BKL:CODE:rid]` 또는 휴리스틱으로 유형화 — 영문 raw 문구 대신
    // 한글 안내 + 요청 ID.
    return <BklErrorNotice error={classifyBklError(text)} />;
  }

  const json = JSON.parse(jsonString);
  const errorKey = json.code || json.type;
  const keyExists = errorKey && errorMessages[errorKey];

  if (keyExists && typeof errorMessages[errorKey] === 'function') {
    return errorMessages[errorKey](json, localize);
  } else if (keyExists && keyExists.startsWith(localizedErrorPrefix)) {
    return localize(errorMessages[errorKey]);
  } else if (keyExists) {
    return errorMessages[errorKey];
  } else {
    // LibreChat 코드표에 없는 JSON (bkl-api 봉투 `{error:{code,…}}` 포함)
    const hasBklEnvelope =
      json &&
      typeof json === 'object' &&
      (json.error?.code || json.request_id || json.error?.request_id);
    return <BklErrorNotice error={classifyBklError(hasBklEnvelope ? json : text)} />;
  }
};

export default Error;
