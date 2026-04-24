// Content script — injected into https://*.bunjang.co.kr/*
// 역할:
//   1. background로부터 'inject' 메시지 수신
//   2. SELECTORS로 폼 필드 찾기 (다중 폴백)
//   3. setNativeValue()로 React 호환 값 주입
//   4. 이미지 DataTransfer 주입
//   5. 필드별 성공/실패 결과를 sendResponse로 반환

import type { ExtMessage, InjectResult, Product } from '../lib/types';
import { isExtMessage } from '../lib/messaging';
import { loadImageAsFile } from '../lib/images';

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

// 카테고리 버튼 (mobile legacy)
function findCategoryButton(name: string): HTMLButtonElement | null {
  const btns = [...document.querySelectorAll<HTMLButtonElement>('button[class*="CategoryBoxstyle__CategoryButton"]')];
  return btns.find(b => b.textContent?.trim() === name) ?? null;
}

// ────────────────────────────────────────────────────────────────────
// 3단계 카테고리 아이템 탐색
// columnIndex: 0=대분류, 1=중분류, 2=소분류
// ────────────────────────────────────────────────────────────────────
function findCategoryItem(name: string, columnIndex: number): Element | null {
  // Strategy C: mobile — columnIndex 0 전용
  if (columnIndex === 0) {
    const mobileBtn = findCategoryButton(name);
    if (mobileBtn) return mobileBtn;
  }

  // Strategy A: PC — "카테고리" 섹션 내 columnIndex 번째 열
  const allTextNodes = [...document.querySelectorAll<HTMLElement>('div, span, label')];
  const categoryLabel = allTextNodes.find(
    el => el.children.length === 0 && el.textContent?.trim() === '카테고리'
  );
  if (categoryLabel) {
    // 가장 가까운 그룹 컨테이너 탐색
    let container: Element | null = categoryLabel.parentElement;
    for (let i = 0; i < 5 && container; i++) {
      // 3개 이상의 자식 열을 갖는 컨테이너 찾기
      const columns = [...container.children].filter(
        c => c.tagName !== 'LABEL' && c.querySelectorAll('li, button, [role="option"]').length > 0
      );
      if (columns.length >= 2) {
        const col = columns[columnIndex];
        if (col) {
          const items = [...col.querySelectorAll<HTMLElement>('li, button, [role="option"]')];
          const found = items.find(el => el.textContent?.trim() === name);
          if (found) return found;
        }
        break;
      }
      container = container.parentElement;
    }

    // 열 구조를 못 찾은 경우: 섹션 내 전체 검색 후 columnIndex로 필터
    const section = categoryLabel.closest('section, [class*="Group"], [class*="Section"], [class*="Category"]') ?? categoryLabel.parentElement;
    if (section) {
      const candidates = [...section.querySelectorAll<HTMLElement>('li, button, [role="option"], [class*="ategory"] li')];
      const exact = candidates.filter(
        el =>
          el.textContent?.trim() === name &&
          (el as HTMLElement).offsetParent !== null &&
          el.querySelector('span, div') === null // leaf 우선
      );
      if (exact.length > 0) return exact[0];
      // leaf 조건 없이 재시도
      const fallback = candidates.filter(
        el => el.textContent?.trim() === name && (el as HTMLElement).offsetParent !== null
      );
      if (fallback.length > 0) return fallback[0];
    }
  }

  // Strategy B: 전역 폴백 — 텍스트 정확 일치 + 가시 + leaf 우선
  const allItems = [...document.querySelectorAll<HTMLElement>(
    'li, button, [role="option"], [class*="ategory"] *'
  )];
  const visibleExact = allItems.filter(
    el =>
      el.textContent?.trim() === name &&
      (el as HTMLElement).offsetParent !== null
  );
  // leaf(자식에 텍스트 없음) 우선
  const leaf = visibleExact.find(
    el => !([...el.children] as HTMLElement[]).some(c => c.textContent?.trim())
  );
  return leaf ?? visibleExact[0] ?? null;
}

// ────────────────────────────────────────────────────────────────────
// 3단계 카테고리 순차 클릭
// path: ['대분류', '중분류', '소분류'] (1~3개)
// ────────────────────────────────────────────────────────────────────
async function injectCategoryPath(path: string[]): Promise<InjectResult> {
  const pathStr = path.join(' > ');
  for (let i = 0; i < Math.min(path.length, 3); i++) {
    const name = path[i];
    const el = findCategoryItem(name, i);
    if (!el) {
      return {
        field: 'category',
        ok: false,
        error: `${pathStr} 중 "${name}" (level ${i + 1}) 못 찾음`,
      };
    }
    (el as HTMLElement).click();
    if (i < path.length - 1) {
      // 다음 열이 렌더링될 때까지 대기
      await new Promise<void>(r => setTimeout(r, 250));
    }
  }
  return {
    field: 'category',
    ok: true,
    selector: 'categoryPath: ' + pathStr,
  };
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

  // 카테고리 — categoryPath 우선, 없으면 legacy single category
  const path = (product.categoryPath && product.categoryPath.length > 0)
    ? product.categoryPath
    : (product.category ? [product.category] : []);
  if (path.length > 0) {
    results.push(await injectCategoryPath(path));
  }

  // 이미지 — IndexedDB 키로 File 복원 후 주입
  if (product.imgs && product.imgs.length > 0) {
    try {
      const filePromises = product.imgs.map(key => loadImageAsFile(key));
      const filesNullable = await Promise.all(filePromises);
      const files = filesNullable.filter((f): f is File => f !== null);
      if (files.length === 0) {
        results.push({ field: 'images', ok: false, error: 'IndexedDB에서 이미지를 복원하지 못함' });
      } else if (files.length < product.imgs.length) {
        // 일부 누락이지만 있는 것만이라도 주입
        const r = await injectImages(files);
        results.push({
          ...r,
          ok: r.ok,
          error: r.error ?? `${files.length}/${product.imgs.length}개만 복원됨`,
        });
      } else {
        results.push(await injectImages(files));
      }
    } catch (e) {
      results.push({ field: 'images', ok: false, error: 'IndexedDB 로드 실패: ' + String(e) });
    }
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
