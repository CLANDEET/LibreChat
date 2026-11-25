import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISharedLink extends Document {
  conversationId: string;
  title?: string;
  user?: string;
  messages?: Types.ObjectId[];
  shareId?: string;
  targetMessageId?: string;
  isPublic: boolean;
  /** BKL: link expiry (null/undefined = no expiry) */
  expiresAt?: Date | null;
  /** BKL: total view count */
  viewCount?: number;
  /** BKL: 공유 시점 출처 스냅샷 (ai-api by-conversation 응답의 messages[] 그대로) */
  bklSources?: unknown[] | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const shareSchema: Schema<ISharedLink> = new Schema(
  {
    conversationId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      index: true,
    },
    user: {
      type: String,
      index: true,
    },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
    shareId: {
      type: String,
      index: true,
    },
    targetMessageId: {
      type: String,
      required: false,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    /** BKL: 공유 링크 만료 시각 (없으면 무제한) */
    expiresAt: {
      type: Date,
      default: null,
    },
    /** BKL: 조회수 */
    viewCount: {
      type: Number,
      default: 0,
    },
    /**
     * BKL: 공유 시점 출처 스냅샷 — ai-api `GET /v1/sources/by-conversation`
     * 의 `messages[]` ({request_id, message_id, sources, hyperlink_map}) 를
     * 그대로 담는다. 공유 열람자는 로그인/ACL 없이 이 스냅샷만 본다.
     * 답변 1건당 ~170KB, 30일 만료로 자연 정리된다.
     */
    bklSources: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

shareSchema.index({ conversationId: 1, user: 1, targetMessageId: 1 });

export default shareSchema;
