// 공용 타입 정의 — 사이드패널 / content script / background 모두 import해서 사용

// ────────────────────────────────────────────────────────────────────
// 상품
// ────────────────────────────────────────────────────────────────────
// 가격 단위 — 원가/판매가에 각각 독립 적용
export type Currency = 'JPY' | 'USD' | 'KRW';

export interface Product {
  id: string;                     // Date.now().toString() 또는 ulid
  title: string;
  cost: number;                   // 원가 (단위는 costCurrency)
  costCurrency?: Currency;        // 원가 단위 — 기본 KRW (대부분 한국 매입; 일본 직구는 ¥로 변경)
  price: number;                  // 판매가 (단위는 priceCurrency)
  priceCurrency?: Currency;       // 판매가 단위 — 기본 KRW (번개장터 등록가)
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
  fxRate: number;                 // [legacy] JPY→KRW 환율 (호환용 — fxRateJpy로 마이그레이션)
  fxRateJpy: number;              // 엔 → 원 환율 (기본 9.3)
  fxRateUsd: number;              // 달러 → 원 환율 (기본 1380)
  shipping: number;               // 배송비 (기본 3500)
  feeRate: number;                // 수수료율 (기본 0.06)
  dark: boolean;
  accent: string;                 // CSS 컬러 (기본 '#151515')
  autoScan: boolean;              // PWA 자동 스캔
  // Sticky 통화 — 사용자가 마지막에 선택한 통화를 다음 상품의 기본값으로
  // (대부분 비즈니스 방향이 일정하므로 매번 바꿀 필요 없게)
  lastCostCurrency?: Currency;    // 기본 KRW
  lastPriceCurrency?: Currency;   // 기본 KRW
}

export const DEFAULT_SETTINGS: Settings = {
  model: 'flash',
  fxRate: 9.3,        // legacy
  fxRateJpy: 9.3,
  fxRateUsd: 1380,
  shipping: 3500,
  feeRate: 0.06,
  dark: false,
  accent: '#151515',
  autoScan: true,
  lastCostCurrency: 'KRW',
  lastPriceCurrency: 'KRW',
};

// 통화 → KRW 환산 단가
export function toKrw(amount: number, currency: Currency, settings: Pick<Settings, 'fxRateJpy' | 'fxRateUsd'>): number {
  if (!amount) return 0;
  switch (currency) {
    case 'KRW': return amount;
    case 'JPY': return amount * (settings.fxRateJpy || 9.3);
    case 'USD': return amount * (settings.fxRateUsd || 1380);
    default: return amount;
  }
}

// 통화 기호
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  JPY: '¥',
  USD: '$',
  KRW: '₩',
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
// 이미지 데이터 — sidepanel(extension origin)에서 IndexedDB로 로드한 후
// content script(bunjang.co.kr origin)로 전달용. base64 dataURL 사용.
export interface InjectImageData {
  name: string;
  type: string;   // MIME (예: 'image/jpeg')
  data: string;   // base64 dataURL (예: 'data:image/jpeg;base64,...')
}

// 모바일 PWA에서 URL 딥링크로 보낸 prefill 데이터
// content script가 ?bjh_prefill=<base64-json> 감지 시 background로 전달, sidepanel이 폼 자동 채움
export interface PrefillPayload {
  v: 1;                        // 스키마 버전
  title?: string;
  brand?: string;
  model?: string;
  modelCode?: string;
  feature?: string;            // AI 입력란용 자유 텍스트 (사이즈/색상 등)
  cost?: number;
  costCurrency?: Currency;
  price?: number;
  priceCurrency?: Currency;
  photoCount?: number;         // 모바일에 남아있는 사진 개수 (안내 표시용)
}

export type ExtMessage =
  | { type: 'inject';            product: Product; imageData?: InjectImageData[] }
  | { type: 'inject:result';     results: InjectResult[] }
  | { type: 'tab:url';           url: string; isBunjang: boolean }
  | { type: 'category:tree' }
  | { type: 'category:tree:result';    ok: boolean; tree?: CategoryTreeNode[]; error?: string }
  | { type: 'category:options';        path: string[] }
  | { type: 'category:options:result'; ok: boolean; groups?: CategoryOptionGroup[]; error?: string }
  | { type: 'prefill';           data: PrefillPayload };
