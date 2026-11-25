/**
 * BKL citation-source remapping for duplicated/forked/branched conversations.
 *
 * Source/citation payloads live in the ai-api Postgres table `bkl_chat_sources`
 * (owned by the Python service), keyed by `request_id` and `message_id`. When
 * LibreChat duplicates/forks a conversation it mints brand-new `messageId`s, so
 * the rows orphan and the copy loses its `[N]` citations. `fork.js` already
 * builds the old→new id map while cloning; this helper forwards it to the ai-api
 * remap endpoint so the copied messages resolve their sources again.
 *
 * Best-effort: any failure is swallowed so a sources-service hiccup can never
 * fail the underlying fork/duplicate.
 */
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

const BKL_BASE_URL = process.env.BKL_API_BASE_URL || 'http://bkl-api:8000';
const BKL_API_TOKEN = process.env.IRE_API_TOKEN || '';

/**
 * Remap BKL citation sources from original message ids to their clones.
 * @param {Map<string, string>} idMapping - original messageId -> new messageId
 * @param {string} [conversationId] - new conversation id for the copied rows
 * @returns {Promise<void>}
 */
async function remapBklChatSources(idMapping, conversationId) {
  if (!idMapping || idMapping.size === 0) {
    return;
  }

  if (!BKL_API_TOKEN) {
    logger.warn('[bklChatSources] IRE_API_TOKEN is not set — skipping citation-source remap');
    return;
  }

  const mappings = [];
  for (const [oldMessageId, newMessageId] of idMapping) {
    if (oldMessageId && newMessageId && oldMessageId !== newMessageId) {
      mappings.push({ old_message_id: oldMessageId, new_message_id: newMessageId });
    }
  }

  if (mappings.length === 0) {
    return;
  }

  try {
    const response = await axios.post(
      `${BKL_BASE_URL}/v1/sources/remap`,
      { mappings, conversation_id: conversationId ?? null },
      {
        headers: {
          Authorization: `Bearer ${BKL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      },
    );
    logger.debug(
      `[bklChatSources] Remapped ${response.data?.remapped ?? '?'}/${mappings.length} citation sources`,
    );
  } catch (err) {
    logger.warn('[bklChatSources] Failed to remap citation sources:', err?.message || err);
  }
}

/**
 * BKL: 공유 링크 생성 시점의 출처 스냅샷.
 *
 * ai-api `GET /v1/sources/by-conversation/{conversationId}` 의 `messages[]`
 * ({request_id, message_id, sources, hyperlink_map}) 를 그대로 돌려준다.
 * 공유 열람자는 로그인/ACL 없이 이 스냅샷만 보므로, 공유자 권한으로 조회된
 * 결과가 곧 공유 범위다 ("공유 텍스트 기준 그대로" 방침, 2026-11-25).
 *
 * `conversationId` 는 **원본** id 여야 한다 — 공유 조회 응답의 conversationId
 * 는 익명화된 값이다. Best-effort: 실패해도 공유 생성은 성공시킨다.
 *
 * @param {string} conversationId - 원본 대화 id
 * @returns {Promise<unknown[] | null>} messages[] 또는 null
 */
async function snapshotBklChatSources(conversationId) {
  if (!conversationId) {
    return null;
  }
  if (!BKL_API_TOKEN) {
    logger.warn('[bklChatSources] IRE_API_TOKEN is not set — skipping share source snapshot');
    return null;
  }
  try {
    const response = await axios.get(
      `${BKL_BASE_URL}/v1/sources/by-conversation/${encodeURIComponent(conversationId)}`,
      {
        headers: { Authorization: `Bearer ${BKL_API_TOKEN}` },
        timeout: 15_000,
      },
    );
    const messages = response.data?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }
    return messages;
  } catch (err) {
    logger.warn('[bklChatSources] Failed to snapshot share sources:', err?.message || err);
    return null;
  }
}

module.exports = { remapBklChatSources, snapshotBklChatSources };
