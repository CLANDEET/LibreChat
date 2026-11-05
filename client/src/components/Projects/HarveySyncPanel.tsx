import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner, useToastContext } from '@librechat/client';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import {
  ProjectsApiError,
  useHarveyProjects,
  useHarveyRefresh,
  useHarveySync,
  useHarveySyncRuns,
} from '~/data-provider/Projects';
import type {
  HarveyProject,
  HarveySyncRun,
  HarveySyncStatus,
  ProjectDetail,
} from '~/data-provider/Projects';
import { cn } from '~/utils';

/**
 * 프로젝트 문서를 Harvey 프로젝트로 보내는 패널.
 *
 * 우리가 Harvey 쪽 프로젝트를 만들지 않는다. 사용자가 Harvey 에서 이미 접근
 * 가능한 프로젝트 중 하나를 골라야 하고, 권한은 BKL 중간 API 가 로그인 이메일로
 * 판정한다. 그래서 이 패널의 첫 역할은 "어디로 보낼지" 고르게 하는 것이다.
 *
 * 전송은 서버가 202 로 받고 백그라운드에서 돈다 — 업로드가 Harvey 조직 합산
 * 분당 10회 한도를 타서 문서가 많으면 수 분이 걸린다. 버튼은 "시작"만 담당하고
 * 진행 상황은 useProject 의 폴링이 갱신하는 status/진행률로 보여준다.
 */
const HarveySyncPanel: React.FC<{ project: ProjectDetail }> = ({ project }) => {
  const { showToast } = useToastContext();
  const harveySync = useHarveySync();
  const harveyRefresh = useHarveyRefresh();
  const harveyProjects = useHarveyProjects();
  const [pickedId, setPickedId] = useState<string>('');

  // 다른 BKL 프로젝트로 넘어가면 이전에 고른 대상은 무의미하다.
  useEffect(() => {
    setPickedId('');
  }, [project.project_id]);

  const status = project.harvey_sync_status ?? null;
  const total = project.document_count;
  const done = project.harvey_synced_count ?? 0;
  const isSyncing = status === 'syncing' || harveySync.isLoading;

  // 2026-11-05 BKL 요청: 중간 API 가 iManage 연동 이력이 있는 Vault 를 canUpload:false
  // 로 내려준다 (쓰기 권한 없음도 동일). 그런 프로젝트는 '(업로드 불가)' 로 보여주지
  // 않고 목록에서 아예 뺀다 — iManage 자동 동기화가 올린 파일을 지워 버리기 때문.
  const options = useMemo<HarveyProject[]>(
    () => (harveyProjects.data ?? []).filter((o) => o.can_upload),
    [harveyProjects.data],
  );
  const storedId = project.harvey_vault_id ?? null;
  const storedInList = storedId != null && options.some((o) => o.project_id === storedId);

  // 사용자가 고른 게 우선. 없으면 이미 연결된 프로젝트가 목록에 있을 때 그걸로.
  const effectiveId = pickedId || (storedInList ? storedId : '') || '';
  const target: HarveyProject | undefined = useMemo(
    () => options.find((o) => o.project_id === effectiveId),
    [options, effectiveId],
  );

  // 연결돼 있던 프로젝트가 목록에서 사라졌다 — 권한 회수, iManage 연동(canUpload:false),
  // 또는 예전 방식으로 만든 vault. 다른 대상을 골라야 한다는 걸 알려준다.
  const storedMissing =
    storedId != null && !storedInList && harveyProjects.isSuccess && options.length > 0;
  const retargeting = Boolean(target) && storedId != null && effectiveId !== storedId && done > 0;

  const listError = harveyProjects.error;
  const listErrorStatus = listError instanceof ProjectsApiError ? listError.status : null;

  const canSend = !isSyncing && total > 0 && Boolean(target?.can_upload);

  const handleSync = async () => {
    if (!target) {
      return;
    }
    try {
      await harveySync.mutateAsync({
        projectId: project.project_id,
        harveyProjectId: target.project_id,
        harveyProjectName: target.project_name,
      });
      showToast({
        message: `Harvey '${target.project_name}'으로 전송을 시작했습니다`,
        status: 'success',
      });
    } catch (e) {
      // 503=미설정, 409=이미 진행 중, 400=대상/이메일. 원문 detail 이 한국어라 그대로 쓴다.
      const detail = e instanceof Error ? e.message : String(e);
      const code = e instanceof ProjectsApiError ? e.status : null;
      showToast({
        message: code === 503 ? `Harvey 연동이 아직 설정되지 않았습니다 — ${detail}` : detail,
        status: 'error',
      });
    }
  };

  const handleRefresh = async () => {
    try {
      const r = await harveyRefresh.mutateAsync();
      showToast({
        message:
          r.projects_processed != null
            ? `Harvey 프로젝트 목록을 갱신했습니다 (${r.projects_processed}건 반영)`
            : 'Harvey 프로젝트 목록을 갱신했습니다',
        status: 'success',
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      showToast({ message: detail, status: 'error' });
    }
  };

  const [historyOpen, setHistoryOpen] = useState(false);
  const runs = useHarveySyncRuns(project.project_id);

  // 전송이 끝나면(폴링이 status 를 바꾸면) 이력도 새로 읽는다 — 마지막 회차가
  // 방금 닫혔을 테니. 시작 시점은 useHarveySync.onSuccess 가 invalidate 한다.
  const refetchRuns = runs.refetch;
  useEffect(() => {
    if (status !== 'syncing') {
      void refetchRuns();
    }
  }, [status, project.harvey_synced_at, refetchRuns]);

  const targetName = project.harvey_vault_name ?? target?.project_name ?? null;
  const runCount = runs.data?.length ?? 0;
  const showProgress = isSyncing || status === 'partial';

  return (
    <div
      className="flex flex-col border-b border-border-light bg-surface-secondary px-4 py-3"
      data-testid="harvey-sync-panel"
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <StatusIcon isSyncing={isSyncing} status={status} />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-medium text-text-primary">Harvey 전송</span>
            <StatusBadge status={isSyncing ? 'syncing' : status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
            <StatusLine
              isSyncing={isSyncing}
              status={status}
              done={done}
              total={total}
              targetName={targetName}
              syncedAt={project.harvey_synced_at ?? null}
            />
          </div>

          {project.harvey_sync_error && !isSyncing && (
            <p className="text-[11px] leading-relaxed text-text-tertiary">
              {project.harvey_sync_error}
              {status === 'error' && (
                <>
                  {' '}
                  — Harvey에서 이 프로젝트의 업로드 권한을 확인하거나 다른 프로젝트를 선택하세요.
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <TargetPicker
            options={options}
            value={effectiveId}
            onChange={setPickedId}
            disabled={isSyncing}
            isLoading={harveyProjects.isLoading}
            errorStatus={listErrorStatus}
            errorMessage={listError?.message ?? null}
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 rounded-md p-0"
            title="Harvey에서 방금 만든 프로젝트가 보이지 않으면 목록을 갱신합니다"
            aria-label="Harvey 프로젝트 목록 새로고침"
            disabled={harveyRefresh.isLoading || listErrorStatus === 503}
            onClick={handleRefresh}
          >
            {harveyRefresh.isLoading ? (
              <Spinner className="size-3.5" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            )}
          </Button>

          <Button
            type="button"
            variant={status === 'synced' ? 'outline' : 'default'}
            size="sm"
            className="h-7 shrink-0 gap-1.5 rounded-md px-2.5 text-xs"
            disabled={!canSend}
            onClick={handleSync}
          >
            {isSyncing ? (
              <Spinner className="size-3.5" />
            ) : (
              <Send className="size-3.5" aria-hidden="true" />
            )}
            {buttonLabel(isSyncing, status, retargeting)}
          </Button>
        </div>
      </div>

      {showProgress && total > 0 && <ProgressBar done={done} total={total} syncing={isSyncing} />}

      {(storedMissing || retargeting || (harveyProjects.isSuccess && options.length === 0)) &&
        !isSyncing && (
          <div className="mt-2 flex flex-col gap-1">
            {storedMissing && (
              <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-500">
                <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                이전에 보냈던 Harvey 프로젝트
                {project.harvey_vault_name ? ` '${project.harvey_vault_name}'` : ''}에 더 이상 보낼
                수 없습니다 (접근 권한 회수 또는 iManage 연동 Vault). 다른 프로젝트를 선택하세요.
              </p>
            )}

            {retargeting && (
              <p className="text-[11px] text-text-tertiary">
                대상을 바꾸면 이미 보낸 {done}건을 포함해 전체 {total}건을 새 프로젝트에 다시
                올립니다.
              </p>
            )}

            {harveyProjects.isSuccess && options.length === 0 && (
              <p className="text-[11px] text-text-tertiary">
                업로드 가능한 Harvey 프로젝트가 없습니다. iManage와 연동되지 않은 새 Vault
                프로젝트를 만들거나 공유받은 뒤 새로고침하세요.
              </p>
            )}
          </div>
        )}

      <div className="mt-2 border-t border-border-light pt-1.5">
        <button
          type="button"
          className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          aria-expanded={historyOpen}
          aria-controls="harvey-sync-history"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          {historyOpen ? (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden="true" />
          )}
          <History className="size-3" aria-hidden="true" />
          전송 내역
          {runs.isSuccess && (
            <span className="text-text-tertiary">{runCount > 0 ? `${runCount}회` : '없음'}</span>
          )}
        </button>

        {historyOpen && (
          <div id="harvey-sync-history" className="mt-1.5">
            <RunHistory runs={runs.data} isLoading={runs.isLoading} error={runs.error} />
          </div>
        )}
      </div>
    </div>
  );
};

/** 상태 공통 색 — 아이콘·배지·진행바가 같은 색을 쓴다. */
const STATUS_META: Record<
  HarveySyncStatus | 'none',
  { label: string; text: string; badge: string; bar: string }
> = {
  none: {
    label: '미전송',
    text: 'text-text-tertiary',
    badge: 'bg-surface-tertiary text-text-secondary',
    bar: 'bg-text-tertiary',
  },
  syncing: {
    label: '전송 중',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    bar: 'bg-blue-500',
  },
  synced: {
    label: '완료',
    text: 'text-green-600 dark:text-green-500',
    badge: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    bar: 'bg-green-500',
  },
  partial: {
    label: '일부 남음',
    text: 'text-amber-600 dark:text-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  error: {
    label: '실패',
    text: 'text-red-600 dark:text-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    bar: 'bg-red-500',
  },
};

const StatusBadge: React.FC<{ status: HarveySyncStatus | null }> = ({ status }) => {
  const meta = STATUS_META[status ?? 'none'];
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center rounded-full px-1.5 text-[10px] font-medium leading-none',
        meta.badge,
      )}
      data-testid="harvey-status-badge"
    >
      {meta.label}
    </span>
  );
};

const STATUS_ICON: Record<HarveySyncStatus | 'none', React.ReactNode> = {
  none: <Send className="size-3.5" />,
  syncing: <Spinner className="size-3.5" />,
  synced: <CheckCircle2 className="size-4" />,
  partial: <AlertTriangle className="size-4" />,
  error: <XCircle className="size-4" />,
};

const StatusIcon: React.FC<{ isSyncing: boolean; status: HarveySyncStatus | null }> = ({
  isSyncing,
  status,
}) => {
  const key: HarveySyncStatus | 'none' = isSyncing ? 'syncing' : (status ?? 'none');
  return (
    <span
      className={cn(
        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-primary',
        STATUS_META[key].text,
      )}
      aria-hidden="true"
    >
      {STATUS_ICON[key]}
    </span>
  );
};

const ProgressBar: React.FC<{ done: number; total: number; syncing: boolean }> = ({
  done,
  total,
  syncing,
}) => {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const meta = STATUS_META[syncing ? 'syncing' : 'partial'];
  return (
    <div
      className="mt-2 flex items-center gap-2"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label="Harvey 전송 진행률"
    >
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-tertiary">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', meta.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-text-secondary">
        {done}/{total}건 · {pct}%
      </span>
    </div>
  );
};

const RunHistory: React.FC<{
  runs: HarveySyncRun[] | undefined;
  isLoading: boolean;
  error: Error | null;
}> = ({ runs, isLoading, error }) => {
  if (isLoading) {
    return (
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-text-tertiary">
        <Spinner className="size-3" /> 전송 내역 불러오는 중
      </p>
    );
  }
  if (error) {
    return (
      <p className="px-1 text-[11px] text-amber-600 dark:text-amber-500">
        전송 내역을 불러오지 못했습니다 — {error.message}
      </p>
    );
  }
  if (!runs || runs.length === 0) {
    return (
      <p className="px-1 text-[11px] text-text-tertiary">
        아직 기록된 전송 내역이 없습니다. (내역은 2026년 11월 이후 전송부터 남습니다.)
      </p>
    );
  }
  return (
    <ol className="flex flex-col divide-y divide-border-light rounded-md border border-border-light bg-surface-primary">
      {runs.map((run) => (
        <RunRow key={run.run_id} run={run} />
      ))}
    </ol>
  );
};

function runSummary(run: HarveySyncRun): string {
  const pending = run.pending_docs ?? 0;
  if (run.status === 'syncing') {
    return pending > 0 ? `${pending}건 전송 중` : '전송 중';
  }
  if (run.status === 'synced') {
    return run.uploaded > 0 ? `${run.uploaded}건 전송` : '새로 보낼 문서 없음';
  }
  if (run.status === 'partial') {
    return `${run.uploaded}/${pending}건 전송`;
  }
  return run.uploaded > 0 ? `${run.uploaded}건 전송 후 중단` : '전송 실패';
}

const RunRow: React.FC<{ run: HarveySyncRun }> = ({ run }) => {
  const [showFailed, setShowFailed] = useState(false);
  const meta = STATUS_META[run.status];
  const where = run.harvey_project_name ?? run.harvey_project_id ?? '—';
  const failedDocs = run.failed_docs ?? [];

  return (
    <li className="flex flex-col gap-0.5 px-2.5 py-1.5 text-[11px]" data-testid="harvey-run">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="w-[108px] shrink-0 tabular-nums text-text-tertiary">
          {formatDateTime(run.started_at)}
        </span>
        <span
          className={cn(
            'inline-flex h-[16px] items-center rounded-full px-1.5 text-[10px] font-medium leading-none',
            meta.badge,
          )}
        >
          {meta.label}
        </span>
        <span className="min-w-0 truncate text-text-primary" title={where}>
          {where}
        </span>
        {run.target_changed && (
          <span className="rounded bg-surface-tertiary px-1 text-[10px] text-text-secondary">
            대상 변경
          </span>
        )}
        <span className="ml-auto shrink-0 tabular-nums text-text-secondary">{runSummary(run)}</span>
      </div>
      {(run.error || failedDocs.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-2 pl-[116px] text-text-tertiary">
          {run.error && <span className="min-w-0 truncate">{run.error}</span>}
          {failedDocs.length > 0 && (
            <button
              type="button"
              className="shrink-0 underline-offset-2 hover:text-text-primary hover:underline"
              onClick={() => setShowFailed((v) => !v)}
            >
              실패 문서 {failedDocs.length}건 {showFailed ? '접기' : '보기'}
            </button>
          )}
        </div>
      )}
      {showFailed && failedDocs.length > 0 && (
        <ul className="flex flex-col gap-0.5 pl-[116px] text-text-tertiary">
          {failedDocs.map((d) => (
            <li
              key={d.doc_id}
              className="truncate"
              title={`${d.file_name ?? d.doc_id} — ${d.reason}`}
            >
              <span className="text-text-secondary">{d.file_name ?? d.doc_id}</span> — {d.reason}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

const TargetPicker: React.FC<{
  options: HarveyProject[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  isLoading: boolean;
  errorStatus: number | null;
  errorMessage: string | null;
}> = ({ options, value, onChange, disabled, isLoading, errorStatus, errorMessage }) => {
  if (isLoading) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
        <Spinner className="size-3.5" /> Harvey 프로젝트 불러오는 중
      </span>
    );
  }

  if (errorStatus != null) {
    const text = listErrorText(errorStatus, errorMessage);
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
        <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
        {text}
      </span>
    );
  }

  return (
    <select
      aria-label="전송할 Harvey 프로젝트"
      className="h-7 max-w-[260px] shrink-0 truncate rounded-md border border-border-medium bg-surface-primary px-2 text-xs text-text-primary disabled:opacity-60"
      value={value}
      disabled={disabled || options.length === 0}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Harvey 프로젝트 선택</option>
      {options.map((o) => (
        <option key={o.project_id} value={o.project_id}>
          {o.project_name}
        </option>
      ))}
    </select>
  );
};

function listErrorText(status: number, message: string | null): string {
  if (status === 503) {
    return 'Harvey 연동이 아직 설정되지 않았습니다';
  }
  if (status === 400) {
    return '로그인 이메일을 확인할 수 없어 Harvey 프로젝트를 조회하지 못했습니다';
  }
  return message || 'Harvey 프로젝트를 불러오지 못했습니다';
}

function buttonLabel(
  isSyncing: boolean,
  status: HarveySyncStatus | null,
  retargeting: boolean,
): string {
  if (isSyncing) {
    return '전송 중';
  }
  if (retargeting) {
    return '새 프로젝트로 보내기';
  }
  if (status === 'partial' || status === 'error') {
    return '다시 시도';
  }
  if (status === 'synced') {
    return '다시 보내기';
  }
  return 'Harvey로 보내기';
}

const StatusLine: React.FC<{
  isSyncing: boolean;
  status: HarveySyncStatus | null;
  done: number;
  total: number;
  targetName: string | null;
  syncedAt: string | null;
}> = ({ isSyncing, status, done, total, targetName, syncedAt }) => {
  const where = targetName ? `Harvey '${targetName}'` : 'Harvey';
  const when = syncedAt ? formatDateTime(syncedAt) : '';

  if (isSyncing) {
    return (
      <span className="text-text-primary">
        {where}로 보내는 중{total > 0 ? ` (${done}/${total})` : ''}
      </span>
    );
  }

  if (status === 'synced') {
    return (
      <>
        <span className="text-text-primary">
          {where}에 {done}건 전송 완료
        </span>
        {when && <span className="text-text-tertiary">· {when}</span>}
      </>
    );
  }

  if (status === 'partial' || status === 'error') {
    return (
      <>
        <span className="text-text-primary">
          {status === 'partial'
            ? `${where}에 ${done}/${total}건 전송 — 일부가 남았습니다`
            : `${where} 전송에 실패했습니다`}
        </span>
        {when && <span className="text-text-tertiary">· {when}</span>}
      </>
    );
  }

  return (
    <span className="text-text-secondary">
      담은 문서를 내 Harvey 프로젝트로 보내 Harvey에서 이어서 검토할 수 있습니다.
    </span>
  );
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

export default HarveySyncPanel;
