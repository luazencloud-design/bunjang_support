// Content script — injected into https://*.bunjang.co.kr/*
// 역할:
//   1. background로부터 'inject' 메시지 수신
//   2. SELECTORS로 폼 필드 찾기 (다중 폴백)
//   3. setNativeValue()로 React 호환 값 주입
//   4. 이미지 DataTransfer 주입
//   5. 필드별 성공/실패 결과를 sendResponse로 반환

import type {
  ExtMessage,
  InjectResult,
  Product,
  CategoryTreeNode,
  CategoryOptionGroup,
} from '../lib/types';
import { isExtMessage } from '../lib/messaging';
import { loadImageAsFile } from '../lib/images';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

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
  // Strategy C: CategoryBoxstyle__CategoryButton — 대/중/소 모두 같은 클래스 사용
  const mobileBtn = findCategoryButton(name);
  if (mobileBtn) return mobileBtn;

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
// 카테고리 컬럼 컨테이너 + 라벨 추출
// ────────────────────────────────────────────────────────────────────
function getCategoryColumns(): HTMLElement[] | null {
  const allTextNodes = [...document.querySelectorAll<HTMLElement>('div, span, label')];
  const categoryLabel = allTextNodes.find(
    el => el.children.length === 0 && el.textContent?.trim() === '카테고리'
  );
  if (!categoryLabel) return null;

  let container: Element | null = categoryLabel.parentElement;
  for (let i = 0; i < 6 && container; i++) {
    const cols = [...container.children].filter(
      c => c.tagName !== 'LABEL' && c.querySelectorAll('li, button, [role="option"]').length > 0,
    ) as HTMLElement[];
    if (cols.length >= 2) return cols;
    container = container.parentElement;
  }
  return null;
}

function readColumnLabels(col: HTMLElement | undefined): string[] {
  if (!col) return [];
  const items = [...col.querySelectorAll<HTMLElement>('li, button, [role="option"]')];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const el of items) {
    if (el.offsetParent === null) continue;
    const t = (el.textContent ?? '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// 카테고리 트리 추출 — 모든 대분류를 순회하며 클릭 → 중/소분류 수집
// 첫 호출 시 ~30~60초 (브라우저 부하 큼). 결과는 sidepanel에서 캐시.
// ────────────────────────────────────────────────────────────────────
async function extractCategoryTree(): Promise<CategoryTreeNode[]> {
  const cols0 = getCategoryColumns();
  if (!cols0) throw new Error('카테고리 영역을 찾을 수 없음 — m.bunjang.co.kr/products/new 인지 확인');

  const level0 = readColumnLabels(cols0[0]);
  const tree: CategoryTreeNode[] = [];

  for (const name0 of level0) {
    const node: CategoryTreeNode = { name: name0, children: [] };
    const el0 = findCategoryItem(name0, 0);
    if (el0) {
      (el0 as HTMLElement).click();
      await wait(180);
      const cols1 = getCategoryColumns();
      const level1 = cols1 ? readColumnLabels(cols1[1]) : [];

      for (const name1 of level1) {
        const child: CategoryTreeNode = { name: name1, children: [] };
        const el1 = findCategoryItem(name1, 1);
        if (el1) {
          (el1 as HTMLElement).click();
          await wait(180);
          const cols2 = getCategoryColumns();
          const level2 = cols2 ? readColumnLabels(cols2[2]) : [];
          child.children = level2.map(n => ({ name: n }));
        }
        node.children!.push(child);
      }
    }
    tree.push(node);
  }

  return tree;
}

// ────────────────────────────────────────────────────────────────────
// 추가 옵션 추출 — 소분류 선택 후 나타나는 사이즈/색상 등
// ────────────────────────────────────────────────────────────────────
function snapshotFieldLabels(): Set<string> {
  const labels = [...document.querySelectorAll<HTMLElement>(
    '[class*="ProductNewstyle__Group"] [class*="Label"], [class*="ProductNewstyle__Group"] label, [class*="ProductNewstyle__Group"] > div > div > span',
  )];
  const out = new Set<string>();
  for (const el of labels) {
    if (el.offsetParent === null) continue;
    const t = (el.textContent ?? '').trim();
    if (t && t.length < 20) out.add(t);
  }
  return out;
}

function extractGroupForLabel(labelText: string): CategoryOptionGroup | null {
  // 라벨 텍스트와 정확히 일치하는 leaf 텍스트 노드를 찾고 그 그룹 컨테이너에서 옵션 수집
  const candidates = [...document.querySelectorAll<HTMLElement>('label, span, div, p')];
  const labelEl = candidates.find(
    el => el.children.length === 0 && el.textContent?.trim() === labelText && el.offsetParent !== null,
  );
  if (!labelEl) return null;

  const group = labelEl.closest('[class*="ProductNewstyle__Group"], [class*="Group"], section, fieldset')
    ?? labelEl.parentElement?.parentElement;
  if (!group) return null;

  const options: string[] = [];
  const seen = new Set<string>();

  // 1. <select>
  const selects = [...group.querySelectorAll<HTMLSelectElement>('select')];
  for (const sel of selects) {
    for (const opt of [...sel.options]) {
      const t = opt.text.trim();
      if (!t || t === '선택' || t.startsWith('선택') || seen.has(t)) continue;
      seen.add(t);
      options.push(t);
    }
  }
  if (options.length > 0) return { name: labelText, options };

  // 2. button / li / radio label
  const btns = [...group.querySelectorAll<HTMLElement>('button, li, label')];
  for (const b of btns) {
    if (b.offsetParent === null) continue;
    const t = (b.textContent ?? '').trim();
    if (!t || t === labelText || t.length > 30 || seen.has(t)) continue;
    // 카테고리 컬럼 안의 항목은 제외
    if (b.closest('[class*="Category"]')) continue;
    seen.add(t);
    options.push(t);
  }
  if (options.length > 0) return { name: labelText, options };

  return null;
}

async function extractCategoryOptions(path: string[]): Promise<CategoryOptionGroup[]> {
  const before = snapshotFieldLabels();

  // 경로 클릭
  for (let i = 0; i < Math.min(path.length, 3); i++) {
    const el = findCategoryItem(path[i], i);
    if (!el) throw new Error(`경로 클릭 실패: ${path[i]} (level ${i + 1})`);
    (el as HTMLElement).click();
    await wait(220);
  }
  await wait(400);

  const after = snapshotFieldLabels();
  const newLabels: string[] = [];
  for (const l of after) {
    if (!before.has(l)) newLabels.push(l);
  }
  // 카테고리 자체 라벨 등 무관한 항목 제외
  const SKIP = new Set(['카테고리', '대분류', '중분류', '소분류', '상품명', '가격', '배송비', '직거래', '상품상태', '설명', '태그', '수량', '브랜드']);
  const filtered = newLabels.filter(l => !SKIP.has(l));

  const groups: CategoryOptionGroup[] = [];
  for (const label of filtered) {
    const g = extractGroupForLabel(label);
    if (g && g.options.length > 0) groups.push(g);
  }
  return groups;
}

// ────────────────────────────────────────────────────────────────────
// 추가 옵션 클릭 — categoryOptions { '사이즈': '250' } 같은 매핑
// ────────────────────────────────────────────────────────────────────
function injectCategoryOption(groupName: string, value: string): InjectResult {
  // 라벨 찾기
  const labelEl = [...document.querySelectorAll<HTMLElement>('label, span, div, p')].find(
    el => el.children.length === 0 && el.textContent?.trim() === groupName && el.offsetParent !== null,
  );
  if (!labelEl) return { field: `option:${groupName}`, ok: false, error: `${groupName} 라벨 못 찾음` };

  const group = labelEl.closest('[class*="ProductNewstyle__Group"], [class*="Group"], section, fieldset')
    ?? labelEl.parentElement?.parentElement;
  if (!group) return { field: `option:${groupName}`, ok: false, error: `${groupName} 그룹 컨테이너 못 찾음` };

  // 1. select
  const sel = group.querySelector<HTMLSelectElement>('select');
  if (sel) {
    const opt = [...sel.options].find(o => o.text.trim() === value || o.value === value);
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { field: `option:${groupName}`, ok: true, selector: `select[label="${groupName}"]` };
    }
  }

  // 2. button / li
  const clickables = [...group.querySelectorAll<HTMLElement>('button, li, label')];
  const target = clickables.find(b => b.offsetParent !== null && (b.textContent ?? '').trim() === value);
  if (target) {
    (target as HTMLElement).click();
    return { field: `option:${groupName}`, ok: true, selector: `button[text="${value}"]` };
  }

  return { field: `option:${groupName}`, ok: false, error: `"${value}" 선택지 못 찾음` };
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
      // 다음 열이 렌더링될 때까지 대기 (React re-render)
      await wait(450);
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
    // 추가 옵션 (사이즈 등) — 경로 클릭 후 렌더 대기
    if (product.categoryOptions && Object.keys(product.categoryOptions).length > 0) {
      await wait(400);
      for (const [groupName, value] of Object.entries(product.categoryOptions)) {
        if (!value) continue;
        results.push(injectCategoryOption(groupName, value));
      }
    }
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

  if (msg.type === 'category:tree') {
    extractCategoryTree()
      .then(tree => sendResponse({ type: 'category:tree:result', ok: true, tree }))
      .catch(e => sendResponse({ type: 'category:tree:result', ok: false, error: String(e?.message || e) }));
    return true;
  }

  if (msg.type === 'category:options') {
    extractCategoryOptions(msg.path)
      .then(groups => sendResponse({ type: 'category:options:result', ok: true, groups }))
      .catch(e => sendResponse({ type: 'category:options:result', ok: false, error: String(e?.message || e) }));
    return true;
  }
});
