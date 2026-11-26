import { atom } from 'recoil';

const STORAGE_KEY = 'bkl_query_enhance_enabled';

const readInitial = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const writeStorage = (v: boolean) => {
  if (typeof localStorage === 'undefined') return;
  try {
    if (v) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
};

export const queryEnhanceEnabled = atom<boolean>({
  key: 'bklQueryEnhanceEnabled',
  default: readInitial(),
  effects: [
    ({ onSet }) => {
      onSet((newValue) => writeStorage(!!newValue));
    },
  ],
});

/**
 * 딥 서치 배지 — 켜면 질의 앞에 `[BKL_DEEP_SEARCH:on]` 이 붙어 서버가 재검색
 * 상한을 4회로 올린다 (기본 2회). 쿼리 강화와 같은 방식으로 localStorage 에
 * 유지되므로, 한 번 켜 두면 새로고침 후에도 모든 질의가 딥 서치로 나간다 —
 * 배지 강조(isCheckedClassName) 로 상태를 항상 보이게 한다.
 */
const DEEP_SEARCH_STORAGE_KEY = 'bkl_deep_search_enabled';

const readDeepSearchInitial = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(DEEP_SEARCH_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const deepSearchEnabled = atom<boolean>({
  key: 'bklDeepSearchEnabled',
  default: readDeepSearchInitial(),
  effects: [
    ({ onSet }) => {
      onSet((newValue) => {
        if (typeof localStorage === 'undefined') return;
        try {
          if (newValue) localStorage.setItem(DEEP_SEARCH_STORAGE_KEY, '1');
          else localStorage.removeItem(DEEP_SEARCH_STORAGE_KEY);
        } catch {
          // noop
        }
      });
    },
  ],
});

export interface BklMatterSelection {
  matter_uid: string;
  label: string;
  sub?: string;
}

export interface BklDocSelection {
  doc_id: string;
  label: string;
}

export const filterBklMatters = atom<BklMatterSelection[]>({
  key: 'bklFilterMatters',
  default: [],
});

export const filterBklDocs = atom<BklDocSelection[]>({
  key: 'bklFilterDocs',
  default: [],
});

/** 파일명 부분일치 스코프 — "SSA" 처럼 파일명에 들어가는 키워드. null 이면 없음. */
export const filterBklFileNamePattern = atom<string | null>({
  key: 'bklFilterFileNamePattern',
  default: null,
});

export const selectedBklMatters = atom<BklMatterSelection[]>({
  key: 'bklSelectedMatters',
  default: [],
});

export const referenceBklMatters = selectedBklMatters;

// 공지 내용이 바뀌면 버전을 올린다 — 이전 공지를 닫은 사용자에게 다시 보이도록.
// v2: 검색 가능 기간 9월 말 → 10월 말 (2026-11-26)
const TOP_BANNER_KEY = 'bkl_top_banner_dismissed_v2';

const readBannerInitial = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(TOP_BANNER_KEY) === '1';
  } catch {
    return false;
  }
};

const writeBanner = (v: boolean) => {
  if (typeof localStorage === 'undefined') return;
  try {
    if (v) localStorage.setItem(TOP_BANNER_KEY, '1');
    else localStorage.removeItem(TOP_BANNER_KEY);
  } catch {
    // noop
  }
};

export const topBannerDismissed = atom<boolean>({
  key: 'bklTopBannerDismissed',
  default: readBannerInitial(),
  effects: [
    ({ onSet }) => {
      onSet((v) => writeBanner(!!v));
    },
  ],
});
