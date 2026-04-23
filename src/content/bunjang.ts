// Content script — injected into https://*.bunjang.co.kr/*
// 역할:
//   1. background로부터 'inject' 메시지 수신
//   2. SELECTORS로 폼 필드 찾기 (다중 폴백)
//   3. setNativeValue()로 React 호환 값 주입
//   4. 이미지 DataTransfer 주입
//   5. 필드별 성공/실패 결과를 sendResponse로 반환

import type { ExtMessage, InjectResult, Product } from '../lib/types';
import { isExtMessage } from '../lib/messaging';

console.log('[bunjang-helper] content script loaded on', location.href);

// ────────────────────────────────────────────────────────────────────
// React 호환 값 설정
// ────────────────────────────────────────────────────────────────────
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ────────────────────────────────────────────────────────────────────
// SELECTORS — 2026-04-23 m.bunjang.co.kr/products/new 실제 검증 완료
// ────────────────────────────────────────────────────────────────────
const SELECTORS = {
  title: [
    'input[placeholder="상품명을 입력해 주세요."]',
    'input[placeholder*="상품명"]',
  ],
  price: [
    'input[placeholder="가격을 입력해 주세요."]',
    'input[placeholder*="가격"]',
  ],
  description: [
    'div[class*="ProductNewstyle__Content"] textarea',
    'textarea:not([name="g-recaptcha-response"])',
  ],
  images: [
    'input[type="file"][accept*="image"]',
    'input[type="file"][multiple]',
  ],
  quantity: [
    'input[placeholder="숫자만 입력해 주세요."]',
  ],
  // 태그 — 2026-04-23 검증
  tag: [
    'input[placeholder="태그를 입력해 주세요. (최대 5개)"]',
    'input[placeholder*="태그"]',
  ],
  inPersonYes: ['input#in-person'],
  inPersonNo:  ['input#not-in-person'],
} as const;

function findFirst(selectors: readonly string[]): Element | null {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

// 배송비 radio — CSS 셀렉터 불가, label 텍스트로 찾기
type ShippingType = '배송비포함' | '배송비별도';
function findShippingRadio(type: ShippingType): HTMLInputElement | null {
  const labels = [...document.querySelectorAll('label')];
  const label = labels.find(l => l.textContent?.trim() === type);
  return (label?.querySelector('input[type="radio"]') as HTMLInputElement) ?? null;
}

// 카테고리 버튼
function findCategoryButton(name: string): HTMLButtonElement | null {
  const btns = [...document.querySelectorAll<HTMLButtonElement>('button[class*="CategoryBoxstyle__CategoryButton"]')];
  return btns.find(b => b.textContent?.trim() === name) ?? null;
}

// 태그 입력 — setNativeValue 후 Enter 키 이벤트로 태그 추가
async function injectTags(tags: string[]): Promise<InjectResult> {
  const input = findFirst(SELECTORS.tag) as HTMLInputElement | null;
  if (!input) {
    return { field: 'tags', ok: false, error: '태그 input을 찾을 수 없음' };
  }
  const MAX_TAGS = 5;
  const toInsert = tags.slice(0, MAX_TAGS);
  let added = 0;
  for (const tag of toInsert) {
    setNativeValue(input, tag);
    // Enter 키로 태그 확정
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', keyCode: 13, bubbles: true }));
    // input 값 초기화 (다음 태그를 위해)
    setNativeValue(input, '');
    added++;
  }
  return { field: 'tags', ok: true, selector: SELECTORS.tag[0] };
}

// 상품 상태 radio — 2026-04-23 검증
// 구조: label > input[type="radio"] + 텍스트노드("새 상품 (미사용)") + span(설명)
// label.textContent는 "새 상품 (미사용)사용하지 않은 새 상품" 형태라 startsWith로 비교
function findConditionRadio(conditionText: string): HTMLInputElement | null {
  const sectionLabel = [...document.querySelectorAll('div,span')].find(
    el => el.children.length === 0 && el.textContent?.trim() === '상품상태'
  );
  const group = sectionLabel?.closest('[class*="ProductNewstyle__Group"]');
  if (!group) return null;
  const condLabels = [...group.querySelectorAll<HTMLLabelElement>('label')];
  const matched = condLabels.find(l => l.textContent?.trim().startsWith(conditionText));
  return (matched?.querySelector('input[type="radio"]') as HTMLInputElement) ?? null;
}

// ────────────────────────────────────────────────────────────────────
// 이미지 파일 주입
// ────────────────────────────────────────────────────────────────────
async function injectImages(files: File[]): Promise<InjectResult> {
  const input = findFirst(SELECTORS.images) as HTMLInputElement | null;
  if (!input) {
    return { field: 'images', ok: false, error: '파일 input을 찾을 수 없음' };
  }
  try {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { field: 'images', ok: true, selector: SELECTORS.images[0] };
  } catch (e) {
    return { field: 'images', ok: false, error: String(e) };
  }
}

// ────────────────────────────────────────────────────────────────────
// 텍스트 필드 주입 헬퍼
// ────────────────────────────────────────────────────────────────────
function injectText(
  field: string,
  selectors: readonly string[],
  value: string | undefined,
): InjectResult {
  if (value === undefined || value === '') {
    return { field, ok: true, selector: '(skipped — 값 없음)' };
  }
  const el = findFirst(selectors) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) {
    return { field, ok: false, error: `셀렉터 없음: ${selectors.join(', ')}` };
  }
  try {
    setNativeValue(el, value);
    return { field, ok: true, selector: selectors.find(s => document.querySelector(s)) };
  } catch (e) {
    return { field, ok: false, error: String(e) };
  }
}

// ────────────────────────────────────────────────────────────────────
// 전체 주입 실행
// ────────────────────────────────────────────────────────────────────
async function injectProduct(product: Product): Promise<InjectResult[]> {
  const results: InjectResult[] = [];

  // 텍스트 필드
  results.push(injectText('title',       SELECTORS.title,       product.title));
  results.push(injectText('price',       SELECTORS.price,       product.price ? String(product.price) : undefined));
  results.push(injectText('description', SELECTORS.description, product.desc));
  results.push(injectText('quantity',    SELECTORS.quantity,    product.quantity ? String(product.quantity) : undefined));

  // 배송비 radio
  if (product.shipping) {
    const radio = findShippingRadio(product.shipping);
    if (radio) {
      radio.click();
      results.push({ field: 'shipping', ok: true, selector: `label[text="${product.shipping}"] input[type="radio"]` });
    } else {
      results.push({ field: 'shipping', ok: false, error: `배송비 radio 못 찾음: ${product.shipping}` });
    }
  }

  // 직거래
  if (product.inPerson !== undefined) {
    const sel = product.inPerson ? SELECTORS.inPersonYes : SELECTORS.inPersonNo;
    const radio = findFirst(sel) as HTMLInputElement | null;
    if (radio) {
      radio.click();
      results.push({ field: 'inPerson', ok: true, selector: sel[0] });
    } else {
      results.push({ field: 'inPerson', ok: false, error: `직거래 radio 못 찾음` });
    }
  }

  // 태그
  if (product.tags && product.tags.length > 0) {
    results.push(await injectTags(product.tags));
  }

  // 상품 상태 (기본값: 새 상품 (미사용))
  const condition = product.condition ?? '새 상품 (미사용)';
  const condRadio = findConditionRadio(condition);
  if (condRadio) {
    condRadio.click();
    results.push({ field: 'condition', ok: true, selector: `상품상태 label startsWith "${condition}"` });
  } else {
    results.push({ field: 'condition', ok: false, error: `상품상태 radio 못 찾음: "${condition}"` });
  }

  // 카테고리
  if (product.category) {
    const btn = findCategoryButton(product.category);
    if (btn) {
      btn.click();
      results.push({ field: 'category', ok: true, selector: `button[text="${product.category}"]` });
    } else {
      results.push({ field: 'category', ok: false, error: `카테고리 버튼 없음: ${product.category}` });
    }
  }

  // 이미지 — Phase 2에서 IndexedDB 연동 예정, 현재는 빈 배열이면 skip
  if (product.imgs && product.imgs.length > 0) {
    // TODO Phase 2: IndexedDB에서 실제 File 객체 로드 후 주입
    results.push({ field: 'images', ok: false, error: 'Phase 2에서 구현 예정 (IndexedDB 연동 필요)' });
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────
// 메시지 리스너
// ────────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (!isExtMessage(msg)) return;

  if (msg.type === 'inject') {
    injectProduct(msg.product).then(results => {
      sendResponse({ type: 'inject:result', results });
    });
    return true; // 비동기 응답 허용
  }
});
