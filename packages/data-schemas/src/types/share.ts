import type { Types } from 'mongoose';
import type { IMessage } from './message';

export interface ISharedLink {
  _id?: Types.ObjectId;
  conversationId: string;
  title?: string;
  user?: string;
  messages?: Types.ObjectId[];
  shareId?: string;
  targetMessageId?: string;
  isPublic: boolean;
  /** BKL: 공유 시점 출처 스냅샷 */
  bklSources?: BklShareSourceEntry[] | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * BKL: 답변 1건의 출처 스냅샷 — ai-api `GET /v1/sources/by-conversation` 의
 * `messages[]` 원소. 공유 응답에서는 `message_id` 가 익명화된 메시지 id 로
 * 치환되어 나간다 (getSharedMessages).
 */
export interface BklShareSourceEntry {
  request_id?: string | null;
  message_id: string;
  created_at?: string | Date | null;
  sources: unknown[];
  hyperlink_map?: Record<string, unknown> | null;
}

export interface ShareServiceError extends Error {
  code: string;
}

export interface SharedLinksResult {
  links: Array<{
    shareId: string;
    title: string;
    isPublic: boolean;
    createdAt: Date;
    conversationId: string;
  }>;
  nextCursor?: Date;
  hasNextPage: boolean;
}

export interface SharedMessagesResult {
  conversationId: string;
  messages: Array<IMessage>;
  shareId: string;
  title?: string;
  isPublic: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  /** BKL: 출처 스냅샷 (message_id 는 응답 messages[] 의 익명 id 와 일치) */
  bklSources?: BklShareSourceEntry[] | null;
}

export interface CreateShareResult {
  shareId: string;
  conversationId: string;
}

export interface UpdateShareResult {
  shareId: string;
  conversationId: string;
}

export interface DeleteShareResult {
  success: boolean;
  shareId: string;
  message: string;
}

export interface GetShareLinkResult {
  shareId: string | null;
  success: boolean;
}

export interface DeleteAllSharesResult {
  message: string;
  deletedCount: number;
}
