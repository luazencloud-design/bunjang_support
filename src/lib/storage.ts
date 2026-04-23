// chrome.storage.local 래퍼
// 사이드패널 / background 에서만 사용 (content script는 chrome.storage 접근 가능하지만 기본적으로 안 씀)

import type { Product, Template, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

// ────────────────────────────────────────────────────────────────────
// 기본 get/set
// ────────────────────────────────────────────────────────────────────
export const storage = {
  get: <T>(key: string): Promise<T | undefined> =>
    chrome.storage.local.get(key).then(r => r[key] as T | undefined),

  set: (key: string, value: unknown): Promise<void> =>
    chrome.storage.local.set({ [key]: value }),

  remove: (key: string): Promise<void> =>
    chrome.storage.local.remove(key),
};

// ────────────────────────────────────────────────────────────────────
// 키 상수
// ────────────────────────────────────────────────────────────────────
const KEYS = {
  DRAFT:     'draft',       // 현재 작성 중인 폼 (Product 부분)
  TEMPLATES: 'templates',   // Template[]
  SETTINGS:  'settings',    // Settings
  HISTORY:   'history',     // Product[] (등록 완료)
} as const;

// ────────────────────────────────────────────────────────────────────
// 초안 (자동 저장)
// ────────────────────────────────────────────────────────────────────
export const draft = {
  get: (): Promise<Partial<Product> | undefined> =>
    storage.get<Partial<Product>>(KEYS.DRAFT),

  set: (data: Partial<Product>): Promise<void> =>
    storage.set(KEYS.DRAFT, data),

  clear: (): Promise<void> =>
    storage.remove(KEYS.DRAFT),
};

// ────────────────────────────────────────────────────────────────────
// 템플릿
// ────────────────────────────────────────────────────────────────────
export const templates = {
  getAll: async (): Promise<Template[]> => {
    const saved = await storage.get<Template[]>(KEYS.TEMPLATES);
    return saved ?? DEFAULT_TEMPLATES;
  },

  save: async (list: Template[]): Promise<void> =>
    storage.set(KEYS.TEMPLATES, list),
};

// ────────────────────────────────────────────────────────────────────
// 설정
// ────────────────────────────────────────────────────────────────────
export const settings = {
  get: async (): Promise<Settings> => {
    const saved = await storage.get<Partial<Settings>>(KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...saved };
  },

  set: (data: Partial<Settings>): Promise<void> =>
    storage.get<Settings>(KEYS.SETTINGS).then(current =>
      storage.set(KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...current, ...data })
    ),
};

// ────────────────────────────────────────────────────────────────────
// 등록 이력
// ────────────────────────────────────────────────────────────────────
export const history = {
  getAll: (): Promise<Product[]> =>
    storage.get<Product[]>(KEYS.HISTORY).then(h => h ?? []),

  add: async (product: Product): Promise<void> => {
    const existing = await history.getAll();
    // 최근 100건만 유지
    const updated = [product, ...existing].slice(0, 100);
    return storage.set(KEYS.HISTORY, updated);
  },

  clear: (): Promise<void> => storage.remove(KEYS.HISTORY),
};

// ────────────────────────────────────────────────────────────────────
// 기본 템플릿 (SidePanel 디자인 원본과 동일한 6개)
// ────────────────────────────────────────────────────────────────────
const DEFAULT_TEMPLATES: Template[] = [
  { id: 'tpl-1', name: '배송안내',  builtin: true,  text: '택배는 매일 오후 2시 이전 주문 건 당일 발송합니다.\n평일 기준이며 주말/공휴일은 익일 발송됩니다.' },
  { id: 'tpl-2', name: '정품보증',  builtin: true,  text: '정품 구매 상품입니다.\n구매 영수증 및 보증서 함께 발송 가능합니다.' },
  { id: 'tpl-3', name: '문의안내',  builtin: true,  text: '구매 전 궁금하신 점은 번개톡으로 문의 주세요.\n최대한 빠르게 답변 드리겠습니다.' },
  { id: 'tpl-4', name: '상태안내',  builtin: true,  text: '사진에서 보이는 것이 전부입니다.\n중고 상품 특성상 미세한 스크래치나 사용감이 있을 수 있습니다.' },
  { id: 'tpl-5', name: '반품안내',  builtin: true,  text: '단순 변심으로 인한 반품은 어렵습니다.\n상품 불량의 경우 수령 후 24시간 이내 연락 주세요.' },
  { id: 'tpl-6', name: '네고안내',  builtin: true,  text: '가격 제안은 가격 제안 기능을 이용해 주세요.\n무리한 네고는 정중히 거절합니다.' },
];
