/** 프로젝트(Harvey Vault류) API 타입 — bkl-api /api/projects/* 응답과 1:1. */

export type ProjectDocumentOrigin = 'chat' | 'doc_search';

/**
 * Harvey 전송 상태.
 *
 * `null` 은 아직 보낸 적 없음. `partial` 은 일부 문서가 원본을 못 찾았거나
 * 회차 상한을 넘어 남은 상태로, 다시 보내면 남은 것만 올린다. `error` 는
 * 대개 403 — 선택한 Harvey 프로젝트에 대한 업로드 권한이 없는 경우다.
 */
export type HarveySyncStatus = 'syncing' | 'synced' | 'partial' | 'error';

/**
 * 로그인 사용자가 Harvey 에서 접근 가능한 프로젝트 (전송 대상 후보).
 *
 * 우리가 만드는 게 아니라 Harvey 에 이미 있는 것이다. `can_upload` 가 false 면
 * 목록에는 보이지만 대상으로 고를 수 없다.
 */
export interface HarveyProject {
  project_id: string;
  project_name: string;
  created_at: string | null;
  access_level: string | null;
  can_upload: boolean;
}

export interface ProjectSummary {
  project_id: string;
  name: string;
  description: string | null;
  /** 사용자가 고른 Harvey 프로젝트 id. 다시 보내기는 여기로 간다. */
  harvey_vault_id?: string | null;
  harvey_vault_name?: string | null;
  harvey_sync_status?: HarveySyncStatus | null;
  harvey_synced_at?: string | null;
  harvey_sync_error?: string | null;
  created_at: string;
  updated_at: string;
  document_count: number;
  /** Harvey 에 올라간 문서 수. document_count 와 함께 진행률로 쓴다. */
  harvey_synced_count?: number;
}

export interface ProjectDocument {
  doc_id: string;
  collection: string | null;
  file_name: string | null;
  /** 표시용 파일명 (서버 계산, 구버전 응답엔 없음) */
  display_name?: string | null;
  matter_uid: string | null;
  origin: ProjectDocumentOrigin | null;
  added_at: string;
  harvey_file_id?: string | null;
  harvey_synced_at?: string | null;
  harvey_sync_error?: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  documents: ProjectDocument[];
}

export interface HarveySyncStarted {
  started: boolean;
  project_id: string;
  status: 'syncing';
}

/** 회차 안에서 원본을 못 구했거나 업로드되지 못한 문서. */
export interface HarveySyncFailedDoc {
  doc_id: string;
  file_name: string | null;
  reason: string;
}

/**
 * Harvey 전송 회차 1건 (`GET /{id}/harvey-sync/runs`).
 *
 * 프로젝트 행의 `harvey_sync_*` 는 마지막 상태만 들고 있으므로, 이전에 어디로
 * 몇 건을 보냈고 무엇이 왜 실패했는지는 이 이력으로 본다. 2026-11 이후 전송부터
 * 기록된다 — 그 전 회차는 비어 있다.
 */
export interface HarveySyncRun {
  run_id: number;
  harvey_project_id: string | null;
  harvey_project_name: string | null;
  /** 이전 대상과 달라 업로드 기록을 지우고 전부 다시 올린 회차 */
  target_changed: boolean;
  status: HarveySyncStatus;
  /** 회차 시작 시점의 프로젝트 문서 수 */
  total_docs: number | null;
  /** 이번 회차에 올리려던(아직 안 올라간) 문서 수 */
  pending_docs: number | null;
  uploaded: number;
  failed: number;
  remaining: number | null;
  error: string | null;
  failed_docs: HarveySyncFailedDoc[];
  started_at: string;
  finished_at: string | null;
}

export interface HarveyRefreshResult {
  refreshed: boolean;
  projects_processed: number | null;
  snapshot_id: string | null;
}

export interface ProjectDocumentInput {
  doc_id: string;
  collection?: string | null;
  file_name?: string | null;
  matter_uid?: string | null;
  origin?: ProjectDocumentOrigin;
}

export interface AddDocumentsResult {
  added: number;
  skipped: number;
}
