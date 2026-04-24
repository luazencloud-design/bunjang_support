// 공용 타입 정의 — 사이드패널 / content script / background 모두 import해서 사용

// ────────────────────────────────────────────────────────────────────
// 상품
// ────────────────────────────────────────────────────────────────────
export interface Product {
  id: string;                     // Date.now().toString() 또는 ulid
  title: string;
  cost: number;                   // 원가 (엔)
  price: number;                  // 판매가 (원)
  desc: string;                   // 상품 설명
  imgs: string[];                 // IndexedDB 키 목록 (base64 직접 저장 금지)
  brand?: string;
  model?: string;
  category?: string;              // (legacy — 단일 대분류 지원)
  categoryPath?: string[];        // 대/중/소분류 (예: ['가방/지갑','백팩','캐주얼백팩'])
  // 소분류 선택 시 드러나는 추가 옵션 (예: 신발 → {'사이즈': '250'})
  categoryOptions?: Record<string, string>;
  feature?: string;
  quantity?: number;
  tags?: string[];                 // 태그 (최대 5개)
  // 상품 상태 — 번개장터 실제 label 텍스트와 동일 (2026-04-23 검증)
  condition?: '새 상품 (미사용)' | '사용감 없음' | '사용감 적음' | '사용감 많음' | '고장/파손 상품';
  shipping?: '배송비포함' | '배송비별도';
  inPerson?: boolean;             // 직거래 가능 여부
  createdAt: number;
  registeredAt?: number;          // 번개장터 등록 완료 시각
}

// ────────────────────────────────────────────────────────────────────
// 템플릿
// ────────────────────────────────────────────────────────────────────
export interface Template {
  id: string;
  name: string;
  text: string;
  builtin: boolean;               // 기본 6개는 true, 사용자 정의는 false
}

// ────────────────────────────────────────────────────────────────────
// 사용자 설정
// ────────────────────────────────────────────────────────────────────
export interface Settings {
  apiKey?: string;                // Gemini API 키 (사용자 본인, Google AI Studio에서 발급)
  model: 'flash' | 'pro';        // gemini-2.0-flash | gemini-1.5-pro
  fxRate: number;                 // 환율 (기본 9.3)
  shipping: number;               // 배송비 (기본 3500)
  feeRate: number;                // 수수료율 (기본 0.06)
  dark: boolean;
  accent: string;                 // CSS 컬러 (기본 '#151515')
  autoScan: boolean;              // PWA 자동 스캔
}

export const DEFAULT_SETTINGS: Settings = {
  model: 'flash',
  fxRate: 9.3,
  shipping: 3500,
  feeRate: 0.06,
  dark: false,
  accent: '#151515',
  autoScan: true,
};

// ────────────────────────────────────────────────────────────────────
// AI 응답
// ────────────────────────────────────────────────────────────────────
export interface AITitle {
  style: string;
  title: string;
  len: number;
}

export interface AITitleResponse {
  titles: AITitle[];
}

// ────────────────────────────────────────────────────────────────────
// 자동입력 결과 (content script → background → sidepanel)
// ────────────────────────────────────────────────────────────────────
export interface InjectResult {
  field: string;
  ok: boolean;
  selector?: string;
  error?: string;
}

// ────────────────────────────────────────────────────────────────────
// 카테고리 트리
// ────────────────────────────────────────────────────────────────────
export interface CategoryTreeNode {
  name: string;
  children?: CategoryTreeNode[];
}

// 소분류 선택 시 추가로 노출되는 옵션 그룹 (예: 사이즈, 색상)
export interface CategoryOptionGroup {
  name: string;       // 그룹명 (예: '사이즈')
  options: string[];  // 선택지 (예: ['230','235','240'])
}

// ────────────────────────────────────────────────────────────────────
// 컨텍스트 간 메시지 타입
// ────────────────────────────────────────────────────────────────────
export type ExtMessage =
  | { type: 'inject';            product: Product }
  | { type: 'inject:result';     results: InjectResult[] }
  | { type: 'tab:url';           url: string; isBunjang: boolean }
  | { type: 'category:tree' }
  | { type: 'category:tree:result';    ok: boolean; tree?: CategoryTreeNode[]; error?: string }
  | { type: 'category:options';        path: string[] }
  | { type: 'category:options:result'; ok: boolean; groups?: CategoryOptionGroup[]; error?: string };
