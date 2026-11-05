import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HarveySyncPanel from '../HarveySyncPanel';
import { ProjectsApiError } from '~/data-provider/Projects';
import type { HarveyProject, HarveySyncRun, ProjectDetail } from '~/data-provider/Projects';

// jest.mock 팩토리는 mock* 접두 변수만 참조할 수 있다 (호이스팅 보호).
const mockMutateAsync = jest.fn();
const mockRefreshAsync = jest.fn();
const mockShowToast = jest.fn();
const mockState = { isLoading: false, refreshLoading: false };
const mockProjects: {
  data: HarveyProject[] | undefined;
  isLoading: boolean;
  isSuccess: boolean;
  error: Error | null;
} = { data: [], isLoading: false, isSuccess: true, error: null };
const mockRefetchRuns = jest.fn();
const mockRuns: {
  data: HarveySyncRun[] | undefined;
  isLoading: boolean;
  isSuccess: boolean;
  error: Error | null;
  refetch: jest.Mock;
} = { data: [], isLoading: false, isSuccess: true, error: null, refetch: mockRefetchRuns };

jest.mock('~/data-provider/Projects', () => {
  const actual = jest.requireActual('~/data-provider/Projects');
  return {
    ...actual,
    useHarveySync: () => ({
      mutateAsync: mockMutateAsync,
      isLoading: mockState.isLoading,
    }),
    useHarveyRefresh: () => ({
      mutateAsync: mockRefreshAsync,
      isLoading: mockState.refreshLoading,
    }),
    useHarveyProjects: () => mockProjects,
    useHarveySyncRuns: () => mockRuns,
  };
});

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Spinner: (props: any) => <span data-testid="spinner" {...props} />,
  useToastContext: () => ({ showToast: mockShowToast }),
}));

const HP1: HarveyProject = {
  project_id: 'hp-1',
  project_name: '유용한 판례',
  created_at: '2026-09-14T01:11:41+00:00',
  access_level: 'MANAGE',
  can_upload: true,
};
const HP_READONLY: HarveyProject = {
  project_id: 'hp-ro',
  project_name: '읽기전용',
  created_at: null,
  access_level: 'READ',
  can_upload: false,
};

function project(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    project_id: 'p1',
    name: '계약검토',
    description: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    document_count: 3,
    documents: [],
    ...overrides,
  } as ProjectDetail;
}

function setProjects(data: HarveyProject[] | undefined, extra: Partial<typeof mockProjects> = {}) {
  mockProjects.data = data;
  mockProjects.isLoading = false;
  mockProjects.isSuccess = data !== undefined;
  mockProjects.error = null;
  Object.assign(mockProjects, extra);
}

const sendButton = () => screen.getByRole('button', { name: /보내기|다시 시도|전송 중/ });
const picker = () => screen.getByRole('combobox', { name: '전송할 Harvey 프로젝트' });

beforeEach(() => {
  jest.clearAllMocks();
  mockState.isLoading = false;
  mockState.refreshLoading = false;
  mockMutateAsync.mockResolvedValue({ started: true });
  mockRefreshAsync.mockResolvedValue({ refreshed: true, projects_processed: 1, snapshot_id: 's' });
  setProjects([HP1, HP_READONLY]);
  mockRuns.data = [];
  mockRuns.isLoading = false;
  mockRuns.isSuccess = true;
  mockRuns.error = null;
  mockRefetchRuns.mockResolvedValue(undefined);
});

function run(overrides: Partial<HarveySyncRun> = {}): HarveySyncRun {
  return {
    run_id: 1,
    harvey_project_id: 'hp-1',
    harvey_project_name: '유용한 판례',
    target_changed: false,
    status: 'synced',
    total_docs: 3,
    pending_docs: 3,
    uploaded: 3,
    failed: 0,
    remaining: 0,
    error: null,
    failed_docs: [],
    started_at: '2026-11-05T11:30:00Z',
    finished_at: '2026-11-05T11:31:00Z',
    ...overrides,
  };
}

describe('HarveySyncPanel — 대상 선택', () => {
  it('대상을 고르기 전에는 보낼 수 없다', () => {
    render(<HarveySyncPanel project={project()} />);
    expect(picker()).toHaveValue('');
    expect(sendButton()).toBeDisabled();
  });

  it('업로드 불가(canUpload:false — iManage 연동 포함) 프로젝트는 목록에 나오지 않는다', () => {
    render(<HarveySyncPanel project={project()} />);
    expect(screen.queryByRole('option', { name: /읽기전용/ })).toBeNull();
    expect(screen.queryByText(/업로드 불가/)).toBeNull();
    expect(screen.getByRole('option', { name: '유용한 판례' })).toBeInTheDocument();
  });

  it('대상을 고르면 그 id와 이름으로 전송을 시작한다', async () => {
    render(<HarveySyncPanel project={project()} />);

    await userEvent.selectOptions(picker(), 'hp-1');
    expect(sendButton()).toBeEnabled();
    await userEvent.click(sendButton());

    expect(mockMutateAsync).toHaveBeenCalledWith({
      projectId: 'p1',
      harveyProjectId: 'hp-1',
      harveyProjectName: '유용한 판례',
    });
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          message: expect.stringContaining('유용한 판례'),
        }),
      ),
    );
  });

  it('이미 연결된 프로젝트가 목록에 있으면 미리 선택된다', () => {
    render(<HarveySyncPanel project={project({ harvey_vault_id: 'hp-1' })} />);
    expect(picker()).toHaveValue('hp-1');
    expect(sendButton()).toBeEnabled();
  });

  it('연결됐던 프로젝트가 목록에서 사라지면 경고한다', () => {
    render(
      <HarveySyncPanel
        project={project({ harvey_vault_id: 'hp-gone', harvey_vault_name: '옛 프로젝트' })}
      />,
    );
    expect(screen.getByText(/'옛 프로젝트'에 더 이상 보낼 수 없습니다/)).toBeInTheDocument();
    expect(picker()).toHaveValue('');
    expect(sendButton()).toBeDisabled();
  });

  it('보낸 문서가 있는데 대상을 바꾸면 전체 재업로드를 알린다', async () => {
    setProjects([HP1, { ...HP1, project_id: 'hp-2', project_name: '다른 프로젝트' }]);
    render(
      <HarveySyncPanel
        project={project({
          harvey_vault_id: 'hp-1',
          harvey_sync_status: 'synced',
          harvey_synced_count: 3,
        })}
      />,
    );

    await userEvent.selectOptions(picker(), 'hp-2');

    expect(
      screen.getByText(/이미 보낸 3건을 포함해 전체 3건을 새 프로젝트에 다시 올립니다/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /새 프로젝트로 보내기/ })).toBeEnabled();
  });

  it('담긴 문서가 없으면 대상을 골라도 보낼 수 없다', async () => {
    render(<HarveySyncPanel project={project({ document_count: 0 })} />);
    await userEvent.selectOptions(picker(), 'hp-1');
    expect(sendButton()).toBeDisabled();
  });
});

describe('HarveySyncPanel — 목록 상태', () => {
  it('업로드 가능한 프로젝트가 없으면 안내한다', () => {
    setProjects([]);
    render(<HarveySyncPanel project={project()} />);
    expect(screen.getByText(/업로드 가능한 Harvey 프로젝트가 없습니다/)).toBeInTheDocument();
    expect(picker()).toBeDisabled();
  });

  it('새로고침은 스냅샷 갱신을 부르고 결과를 알린다', async () => {
    setProjects([]);
    render(<HarveySyncPanel project={project()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Harvey 프로젝트 목록 새로고침' }));

    expect(mockRefreshAsync).toHaveBeenCalled();
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          message: expect.stringContaining('1건 반영'),
        }),
      ),
    );
  });

  it('새로고침 충돌(409)은 서버 문구를 그대로 보여준다', async () => {
    mockRefreshAsync.mockRejectedValue(new ProjectsApiError('다른 동기화가 진행 중입니다', 409));
    render(<HarveySyncPanel project={project()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Harvey 프로젝트 목록 새로고침' }));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        status: 'error',
        message: '다른 동기화가 진행 중입니다',
      }),
    );
  });

  it('미설정(503)이면 설정 문제임을 알리고 선택지를 감춘다', () => {
    setProjects(undefined, {
      isSuccess: false,
      error: new ProjectsApiError('Harvey 연동이 설정되지 않았습니다 (HARVEY_VAULT_API_BASE)', 503),
    });
    render(<HarveySyncPanel project={project()} />);

    expect(screen.getByText(/아직 설정되지 않았습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
  });

  it('불러오는 동안에는 스피너를 보여준다', () => {
    setProjects(undefined, { isLoading: true, isSuccess: false });
    render(<HarveySyncPanel project={project()} />);
    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument();
  });
});

describe('HarveySyncPanel — 진행 상태', () => {
  it('진행 중에는 진행률을 보여주고 중복 클릭을 막는다', () => {
    render(
      <HarveySyncPanel
        project={project({
          harvey_vault_id: 'hp-1',
          harvey_vault_name: '유용한 판례',
          harvey_sync_status: 'syncing',
          harvey_synced_count: 1,
        })}
      />,
    );

    expect(screen.getByText(/'유용한 판례'로 보내는 중 \(1\/3\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /전송 중/ })).toBeDisabled();
    expect(picker()).toBeDisabled();
  });

  it('완료되면 어디로 몇 건 갔는지 보여주고 다시 보내기를 허용한다', () => {
    render(
      <HarveySyncPanel
        project={project({
          harvey_vault_id: 'hp-1',
          harvey_vault_name: '유용한 판례',
          harvey_sync_status: 'synced',
          harvey_synced_count: 3,
          harvey_synced_at: '2026-09-15T01:30:00Z',
        })}
      />,
    );

    expect(screen.getByText(/'유용한 판례'에 3건 전송 완료/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /다시 보내기/ })).toBeEnabled();
  });

  it('일부만 갔으면 남은 사실과 이유를 보여준다', () => {
    render(
      <HarveySyncPanel
        project={project({
          harvey_vault_id: 'hp-1',
          harvey_sync_status: 'partial',
          harvey_synced_count: 2,
          harvey_sync_error: '1건 원본 확보 실패',
        })}
      />,
    );

    expect(screen.getByText(/2\/3건 전송 — 일부가 남았습니다/)).toBeInTheDocument();
    expect(screen.getByText(/1건 원본 확보 실패/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeEnabled();
  });

  it('권한 오류(error)면 권한 확인 안내를 덧붙인다', () => {
    render(
      <HarveySyncPanel
        project={project({
          harvey_vault_id: 'hp-1',
          harvey_sync_status: 'error',
          harvey_sync_error: '선택한 Harvey 프로젝트에 접근 권한이 없거나 프로젝트가 없습니다',
        })}
      />,
    );

    expect(
      screen.getByText(/업로드 권한을 확인하거나 다른 프로젝트를 선택하세요/),
    ).toBeInTheDocument();
  });

  it('이미 진행 중(409)이면 서버 문구를 그대로 보여준다', async () => {
    mockMutateAsync.mockRejectedValue(new ProjectsApiError('이미 동기화가 진행 중입니다', 409));
    render(<HarveySyncPanel project={project({ harvey_vault_id: 'hp-1' })} />);

    await userEvent.click(sendButton());

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        status: 'error',
        message: '이미 동기화가 진행 중입니다',
      }),
    );
  });
});

describe('HarveySyncPanel — 상태 배지·진행률', () => {
  it('상태 배지가 프로젝트 상태를 따라간다', () => {
    const { rerender } = render(<HarveySyncPanel project={project()} />);
    expect(screen.getByTestId('harvey-status-badge')).toHaveTextContent('미전송');

    rerender(
      <HarveySyncPanel
        project={project({ harvey_vault_id: 'hp-1', harvey_sync_status: 'synced' })}
      />,
    );
    expect(screen.getByTestId('harvey-status-badge')).toHaveTextContent('완료');

    rerender(
      <HarveySyncPanel
        project={project({ harvey_vault_id: 'hp-1', harvey_sync_status: 'error' })}
      />,
    );
    expect(screen.getByTestId('harvey-status-badge')).toHaveTextContent('실패');
  });

  it('진행 중·일부 남음일 때만 진행률 막대를 보여준다', () => {
    const { rerender } = render(
      <HarveySyncPanel
        project={project({
          harvey_vault_id: 'hp-1',
          harvey_sync_status: 'syncing',
          harvey_synced_count: 1,
        })}
      />,
    );
    const bar = screen.getByRole('progressbar', { name: 'Harvey 전송 진행률' });
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(screen.getByText('1/3건 · 33%')).toBeInTheDocument();

    rerender(
      <HarveySyncPanel
        project={project({
          harvey_vault_id: 'hp-1',
          harvey_sync_status: 'synced',
          harvey_synced_count: 3,
        })}
      />,
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('HarveySyncPanel — 전송 내역', () => {
  it('접혀 있다가 펼치면 회차별 시각·상태·대상·건수를 보여준다', async () => {
    mockRuns.data = [
      run({ run_id: 3, status: 'synced', uploaded: 1, pending_docs: 1 }),
      run({
        run_id: 2,
        status: 'partial',
        uploaded: 1,
        pending_docs: 2,
        failed: 1,
        error: '1건 원본 확보 실패',
        failed_docs: [
          { doc_id: 'd2', file_name: 'b.pdf', reason: '원본 파일을 확보하지 못했습니다' },
        ],
        started_at: '2026-11-04T01:12:00Z',
      }),
      run({
        run_id: 1,
        status: 'error',
        uploaded: 0,
        harvey_project_name: '옛 프로젝트',
        target_changed: true,
        error: '접근 권한이 없습니다',
        started_at: '2026-11-01T00:00:00Z',
      }),
    ];
    render(
      <HarveySyncPanel
        project={project({ harvey_vault_id: 'hp-1', harvey_sync_status: 'synced' })}
      />,
    );

    const toggle = screen.getByRole('button', { name: /전송 내역/ });
    expect(toggle).toHaveTextContent('3회');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByTestId('harvey-run')).toHaveLength(0);

    await userEvent.click(toggle);
    const rows = screen.getAllByTestId('harvey-run');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('완료');
    expect(rows[0]).toHaveTextContent('1건 전송');
    expect(rows[1]).toHaveTextContent('일부 남음');
    expect(rows[1]).toHaveTextContent('1/2건 전송');
    expect(rows[1]).toHaveTextContent('1건 원본 확보 실패');
    expect(rows[2]).toHaveTextContent('실패');
    expect(rows[2]).toHaveTextContent('옛 프로젝트');
    expect(rows[2]).toHaveTextContent('대상 변경');
    expect(rows[2]).toHaveTextContent('접근 권한이 없습니다');
  });

  it('회차의 실패 문서를 파일명과 사유로 펼쳐 볼 수 있다', async () => {
    mockRuns.data = [
      run({
        status: 'partial',
        uploaded: 1,
        pending_docs: 2,
        failed: 1,
        failed_docs: [
          { doc_id: 'd2', file_name: 'b.pdf', reason: '원본 파일을 확보하지 못했습니다' },
        ],
      }),
    ];
    render(
      <HarveySyncPanel
        project={project({ harvey_vault_id: 'hp-1', harvey_sync_status: 'partial' })}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /전송 내역/ }));
    expect(screen.queryByText(/b\.pdf/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: '실패 문서 1건 보기' }));
    expect(screen.getByText(/b\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/원본 파일을 확보하지 못했습니다/)).toBeInTheDocument();
  });

  it('내역이 없으면 그렇다고 알려준다', async () => {
    render(<HarveySyncPanel project={project()} />);
    expect(screen.getByRole('button', { name: /전송 내역/ })).toHaveTextContent('없음');
    await userEvent.click(screen.getByRole('button', { name: /전송 내역/ }));
    expect(screen.getByText(/아직 기록된 전송 내역이 없습니다/)).toBeInTheDocument();
  });

  it('전송이 끝나면 내역을 다시 읽는다', () => {
    const { rerender } = render(
      <HarveySyncPanel
        project={project({ harvey_vault_id: 'hp-1', harvey_sync_status: 'syncing' })}
      />,
    );
    mockRefetchRuns.mockClear();
    rerender(
      <HarveySyncPanel
        project={project({
          harvey_vault_id: 'hp-1',
          harvey_sync_status: 'synced',
          harvey_synced_at: '2026-11-05T11:31:00Z',
        })}
      />,
    );
    expect(mockRefetchRuns).toHaveBeenCalled();
  });
});
