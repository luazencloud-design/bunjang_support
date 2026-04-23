// Content script — injected into https://*.bunjang.co.kr/*
// Responsibilities (TODO, port from legacy popup.js / content.js):
//   1. Listen for 'inject:bunjang' messages from the side panel
//   2. Find form fields via multi-selector fallback (SELECTORS table)
//   3. Use setNativeValue() so React picks up the change
//   4. Inject images via DataTransfer + dispatch 'change'
//   5. Report per-field success/fail back to the side panel for the diagnosis section

console.log('[bunjang-helper] content script loaded on', location.href);

// React-compatible value setter (per PROJECT_HANDOFF §6.1).
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ✅ SELECTORS — 2026-04-23 m.bunjang.co.kr/products/new 실제 페이지 검증 완료
// 우선순위 순서 (앞쪽이 먼저 시도됨). placeholder 기반이 가장 안정적.
export const SELECTORS = {
  // 상품명 input
  title: [
    'input[placeholder="상품명을 입력해 주세요."]',
    'input[placeholder*="상품명"]',
  ],

  // 판매가 input
  price: [
    'input[placeholder="가격을 입력해 주세요."]',
    'input[placeholder*="가격"]',
  ],

  // 상품 설명 textarea (placeholder 없음 — 부모 컴포넌트 클래스로 특정)
  // NOTE: g-recaptcha-response textarea가 같은 페이지에 있으므로 부모로 구분
  description: [
    'div[class*="ProductNewstyle__Content"] textarea',
    'textarea:not([name="g-recaptcha-response"]):not([class*="recaptcha"])',
  ],

  // 이미지 파일 input (multiple, image/* 허용)
  images: [
    'input[type="file"][accept*="image"]',
    'input[type="file"][multiple]',
  ],

  // 수량 input
  quantity: [
    'input[placeholder="숫자만 입력해 주세요."]',
  ],

  // 직거래 radio (id 확정)
  inPersonYes: ['input#in-person'],
  inPersonNo:  ['input#not-in-person'],

  // 배송비 radio — id/name 없음. label 텍스트로만 찾을 수 있어서 SELECTORS가 아닌
  // findShippingRadio() 헬퍼로 처리 (아래 참고)
} as const;

// 배송비 radio는 CSS 셀렉터로 못 찾음 — label 텍스트 순회로 찾기
export type ShippingType = '배송비포함' | '배송비별도';
export function findShippingRadio(type: ShippingType): HTMLInputElement | null {
  const labels = [...document.querySelectorAll('label')];
  const label = labels.find(l => l.textContent?.trim() === type);
  return (label?.querySelector('input[type="radio"]') as HTMLInputElement) ?? null;
}

// 카테고리 버튼 — 텍스트로 클릭 (단순 input 아닌 버튼 UI)
// 사용법: findCategoryButton('남성의류')?.click()
export function findCategoryButton(categoryName: string): HTMLButtonElement | null {
  const btns = [...document.querySelectorAll<HTMLButtonElement>('button[class*="CategoryBoxstyle__CategoryButton"]')];
  return btns.find(b => b.textContent?.trim() === categoryName) ?? null;
}

export function findFirst(selectors: readonly string[]): Element | null {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}
