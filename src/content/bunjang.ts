// Content script — injected into https://*.bunjang.co.kr/*
// 역할:
//   1. background로부터 'inject' 메시지 수신
//   2. SELECTORS로 폼 필드 찾기 (다중 폴백)
//   3. setNativeValue()로 React 호환 값 주입
//   4. 이미지 DataTransfer 주입
//   5. 필드별 성공/실패 결과를 sendResponse로 반환
//   6. URL ?bjh_prefill= 감지 → background → sidepanel로 전달 (모바일 PWA → PC 브릿지)

import type {
  ExtMessage,
  InjectResult,
  Product,
  CategoryTreeNode,
  CategoryOptionGroup,
  InjectImageData,
  PrefillPayload,
} from '../lib/types';
import { isExtMessage } from '../lib/messaging';
import { loadImageAsFile } from '../lib/images';

// ────────────────────────────────────────────────────────────────────
// URL prefill 핸들러 — 모바일 PWA에서 보낸 ?bjh_prefill=<base64> 감지
// 페이지 로드 시 1회 + 페이지 navigation 후에도 재확인 (SPA)
// ────────────────────────────────────────────────────────────────────
function checkPrefillFromUrl(): void {
  try {
    const url = new URL(location.href);
    const raw = url.searchParams.get('bjh_prefill');
    if (!raw) return;

    let data: PrefillPayload;
    try {
      const json = decodeURIComponent(escape(atob(raw)));
      data = JSON.parse(json) as PrefillPayload;
    } catch (e) {
      console.warn('[bunjang-helper] bjh_prefill 파싱 실패:', e);
      return;
    }

    if (!data || data.v !== 1) {
      console.warn('[bunjang-helper] 알 수 없는 prefill 스키마 버전:', data);
      return;
    }

    console.log('[bunjang-helper] prefill 감지 — sidepanel로 전달:', data);
    chrome.runtime.sendMessage({ type: 'prefill', data } satisfies ExtMessage)
      .catch(() => {/* sidepanel 닫혀 있으면 background가 받음 */});

    // URL에서 파라미터 제거 (새로고침 시 중복 전달 방지)
    url.searchParams.delete('bjh_prefill');
    history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
  } catch (e) {
    console.warn('[bunjang-helper] checkPrefillFromUrl 실패:', e);
  }
}

// 페이지 로드 시 즉시 체크
checkPrefillFromUrl();

// ────────────────────────────────────────────────────────────────────
// base64 dataURL → File (sidepanel에서 직렬화한 이미지 복원)
// ────────────────────────────────────────────────────────────────────
function dataUrlToFile(d: InjectImageData): File {
  // data:image/jpeg;base64,XXXX
  const comma = d.data.indexOf(',');
  const b64 = comma >= 0 ? d.data.slice(comma + 1) : d.data;
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new File([u8], d.name, { type: d.type || 'image/jpeg' });
}

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
    'li, button, [role="option"], [role="listitem"], [class*="ategory"] *'
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
  if (leaf ?? visibleExact[0]) return leaf ?? visibleExact[0];

  // Strategy D: aria-label / data-* 속성 폴백
  const ariaMatch = [...document.querySelectorAll<HTMLElement>('[aria-label], [data-name], [data-category]')]
    .find(el => {
      const label = el.getAttribute('aria-label') || el.getAttribute('data-name') || el.getAttribute('data-category');
      return label?.trim() === name && (el as HTMLElement).offsetParent !== null;
    });
  return ariaMatch ?? null;
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
// 화면 어디든 보이는 정확 텍스트 일치 leaf 노드 (드롭다운 옵션 탐색용)
function findVisibleLeafByText(value: string): HTMLElement | null {
  // offsetParent 체크는 position:fixed 일부 케이스에서 false negative 가능성 있어
  // getBoundingClientRect 보조 사용
  const isVisible = (el: HTMLElement): boolean => {
    if (el.offsetParent !== null) return true;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // ─── 0. input[value="X"] readonly chip 패턴 ─────────────────
  //    번개장터 사이즈 picker는 옵션이 <input value="265"> chip으로 렌더됨 (textContent 비어있음)
  const inputs = [...document.querySelectorAll<HTMLInputElement>(
    'input[type="text"][readonly], input[readonly]',
  )];
  const inputMatch = inputs.find(i => isVisible(i) && i.value === value);
  if (inputMatch) return inputMatch;
  // 부분 일치 (소수점 단위 차이 등)
  const inputPartial = inputs.find(i => isVisible(i) && i.value.replace(/\s/g,'') === value);
  if (inputPartial) return inputPartial;

  const candidates = [...document.querySelectorAll<HTMLElement>(
    'li, button, [role="option"], [role="menuitem"], [role="listitem"], div, span, a, p, label',
  )];

  // 1. 정확 일치 + 가시 + leaf(자식에 텍스트 없음) 우선
  const exact = candidates.filter(
    el => isVisible(el) && (el.textContent ?? '').trim() === value,
  );
  const leaf = exact.find(
    el => !([...el.children] as HTMLElement[]).some(c => (c.textContent ?? '').trim()),
  );
  if (leaf) return leaf;
  if (exact[0]) return exact[0];

  // 2. 부분 일치 (단위 변형 — '265 mm', '265mm', '265 (us 8)', '265.0', '265 ㎜')
  const norm = (s: string) => s.replace(/\s|mm|MM|cm|CM|㎜|㎝/g, '');
  const partial = candidates.filter(el => {
    if (!isVisible(el)) return false;
    const t = (el.textContent ?? '').trim();
    if (!t || t.length > 30) return false;
    return norm(t) === value || t.startsWith(value + ' ') || t.startsWith(value + '(') || t.startsWith(value + 'mm');
  });
  // partial 중에서도 leaf 우선
  const partialLeaf = partial.find(
    el => !([...el.children] as HTMLElement[]).some(c => (c.textContent ?? '').trim()),
  );
  return partialLeaf ?? partial[0] ?? null;
}

// 트리거에 touch + pointer + mouse + click + 키보드 풀 시퀀스
// m.bunjang.co.kr는 모바일 사이트 — touch 이벤트로 listen할 가능성 높음
function fireOpenSequence(el: HTMLElement): void {
  const opts = { bubbles: true, cancelable: true, view: window } as MouseEventInit;
  const ptrOpts = { ...opts, pointerType: 'touch', pointerId: 1, isPrimary: true } as PointerEventInit;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  // touch events (모바일 사이트 — 가장 먼저 시도)
  try {
    const touchObj = new Touch({
      identifier: 1,
      target: el,
      clientX: x,
      clientY: y,
      pageX: x + window.scrollX,
      pageY: y + window.scrollY,
      screenX: x,
      screenY: y,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    });
    const touchInit = {
      bubbles: true,
      cancelable: true,
      touches: [touchObj],
      targetTouches: [touchObj],
      changedTouches: [touchObj],
    } as TouchEventInit;
    el.dispatchEvent(new TouchEvent('touchstart', touchInit));
    el.dispatchEvent(new TouchEvent('touchend',   { ...touchInit, touches: [], targetTouches: [] }));
  } catch {
    // Touch API 미지원 환경 — 무시
  }

  // pointer events (modern frameworks)
  try {
    el.dispatchEvent(new PointerEvent('pointerdown', ptrOpts));
    el.dispatchEvent(new PointerEvent('pointerup',   ptrOpts));
  } catch {}
  // mouse events (legacy)
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup',   opts));
  // click
  el.click();
  // keyboard (focus 후 Space — combobox/select 패턴)
  if (typeof (el as HTMLElement).focus === 'function') {
    try { (el as HTMLElement).focus(); } catch {}
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup',   { key: ' ', code: 'Space', bubbles: true }));
  }
}

// React 18 fiber에서 onChange 핸들러 추출 (props.onChange / props.onSelect)
// styled-components dropdown의 readonly input에 직접 React 이벤트를 주입하기 위함
type ReactFiberish = {
  return?: ReactFiberish;
  memoizedProps?: Record<string, unknown>;
  stateNode?: { onChange?: (...a: unknown[]) => void };
};
function findReactFiber(el: HTMLElement): ReactFiberish | null {
  const key = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
  if (!key) return null;
  return (el as unknown as Record<string, ReactFiberish>)[key] ?? null;
}
function findReactPropsHandler(el: HTMLElement, names: string[]): ((v: unknown) => void) | null {
  const key = Object.keys(el).find(k => k.startsWith('__reactProps$'));
  if (key) {
    const props = (el as unknown as Record<string, Record<string, unknown>>)[key];
    for (const n of names) {
      const h = props?.[n];
      if (typeof h === 'function') return h as (v: unknown) => void;
    }
  }
  // fiber 트리를 위로 거슬러 올라가며 핸들러 탐색 (래퍼 컴포넌트가 onChange를 들고 있는 경우)
  let fiber = findReactFiber(el);
  for (let i = 0; i < 8 && fiber; i++) {
    const props = fiber.memoizedProps;
    if (props) {
      for (const n of names) {
        const h = props[n];
        if (typeof h === 'function') return h as (v: unknown) => void;
      }
    }
    fiber = fiber.return ?? null;
  }
  return null;
}

function injectCategoryOption(groupName: string, value: string): InjectResult {
  // 라벨 찾기
  const labelEl = [...document.querySelectorAll<HTMLElement>('label, span, div, p')].find(
    el => el.children.length === 0 && el.textContent?.trim() === groupName && el.offsetParent !== null,
  );

  // 그룹 컨테이너 — 라벨 못 찾으면 document 전체로 폴백
  const group: Element = labelEl
    ? (labelEl.closest('[class*="ProductNewstyle__Group"], [class*="Group"], section, fieldset')
        ?? labelEl.parentElement?.parentElement
        ?? document.body)
    : document.body;

  // ─── 1. select ───────────────────────────────────────────────
  const sel = group.querySelector<HTMLSelectElement>('select');
  if (sel) {
    const opt = [...sel.options].find(o => o.text.trim() === value || o.value === value);
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { field: `option:${groupName}`, ok: true, selector: `select[label="${groupName}"]` };
    }
  }

  // ─── 2. readonly input — React fiber에서 onChange/onSelect 직접 호출 ──
  //    번개장터 사이즈 위젯은 styled-components 드롭다운으로,
  //    <input readonly>는 시각적 프록시일 뿐 실제 state는 React 부모가 보유.
  //    setNativeValue로는 React state가 안 바뀌므로 fiber.props에서 핸들러 추출.
  const triggerInput = group.querySelector<HTMLInputElement>(
    'input[type="text"][readonly], input[readonly]',
  );
  if (triggerInput) {
    // (a) React props onChange/onSelect 직접 호출
    const handler = findReactPropsHandler(triggerInput, ['onChange', 'onSelect', 'onValueChange']);
    if (handler) {
      try {
        // 우선 SyntheticEvent 형태로 호출 (onChange가 e.target.value 읽는 일반 패턴)
        handler({ target: { value }, currentTarget: { value } } as unknown);
        return {
          field: `option:${groupName}`,
          ok: true,
          selector: `react.props.onChange("${value}")`,
        };
      } catch {
        // 단순 인자로 재시도 (e.g. (value) => void 시그니처)
        try {
          handler(value);
          return {
            field: `option:${groupName}`,
            ok: true,
            selector: `react.props.onChange(${value})`,
          };
        } catch {
          // fall through
        }
      }
    }

    // (b) setNativeValue 폴백 — 일반 text input이면 통함
    setNativeValue(triggerInput, value);
    // 검증 — 100ms 뒤 value가 살아있는지 확인은 호출자(injectProduct)가 하지 못하므로
    //         일단 OK 반환하고, 안 되면 클릭 폴백을 별도 단계에서 시도
    // 여기서는 value 보존되면 ok로 신뢰
    if (triggerInput.value === value) {
      return {
        field: `option:${groupName}`,
        ok: true,
        selector: `setNativeValue("${value}")`,
      };
    }
  }

  // ─── 3. 그룹 안에 이미 펼쳐진 옵션 (chip/radio 스타일) ────────
  const inGroupExact = [...group.querySelectorAll<HTMLElement>(
    'button, li, label, [role="option"], [role="radio"], div, span, a, p',
  )].filter(el => el.offsetParent !== null && (el.textContent ?? '').trim() === value);
  const inGroupLeaf = inGroupExact.find(
    el => !([...el.children] as HTMLElement[]).some(c => (c.textContent ?? '').trim()),
  );
  const inGroupTarget = inGroupLeaf ?? inGroupExact[0];
  if (inGroupTarget) {
    inGroupTarget.click();
    inGroupTarget.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]')?.click();
    return { field: `option:${groupName}`, ok: true, selector: `<${inGroupTarget.tagName.toLowerCase()}>"${value}"` };
  }

  // ─── 4. document 전역 폴백 ──────────────────────────────────
  const docOpt = findVisibleLeafByText(value);
  if (docOpt) {
    docOpt.click();
    return {
      field: `option:${groupName}`,
      ok: true,
      selector: `doc-search → "${value}"`,
    };
  }

  return {
    field: `option:${groupName}`,
    ok: false,
    error: labelEl
      ? `"${value}" 선택지 못 찾음 (라벨="${groupName}")`
      : `"${groupName}" 라벨 못 찾음 + "${value}" 옵션도 못 찾음`,
  };
}

// picker popup을 사용자 눈에 안 보이게 가림 (자동입력 동안만)
// MutationObserver로 새로 추가되는 popup도 즉시 캐치 → 깜빡임 없음
function installPickerCloak(): { uninstall: () => void } {
  const cloaked: Array<{ el: HTMLElement; orig: string }> = [];

  const cloakIfPopup = (el: HTMLElement): void => {
    if (!(el instanceof HTMLElement)) return;
    // popup 패턴: position:absolute + z-index>0 + (border-radius or border)
    const s = el.style;
    if (s.position === 'absolute' && parseInt(s.zIndex || '0') > 0 &&
        (s.borderRadius || s.border)) {
      cloaked.push({ el, orig: s.opacity });
      s.opacity = '0';
    }
  };

  // 이미 떠 있는 popup 처리
  document.querySelectorAll<HTMLElement>('div').forEach(cloakIfPopup);

  // 새로 추가되는 popup 감시
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) {
          cloakIfPopup(node);
          node.querySelectorAll<HTMLElement>('div').forEach(cloakIfPopup);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return {
    uninstall: () => {
      observer.disconnect();
      for (const c of cloaked) {
        c.el.style.opacity = c.orig;
      }
    },
  };
}

// 비동기 폴백 — readonly 트리거를 클릭해서 드롭다운 열고 옵션 클릭
async function injectCategoryOptionByClick(groupName: string, value: string): Promise<InjectResult> {
  const labelEl = [...document.querySelectorAll<HTMLElement>('label, span, div, p')].find(
    el => el.children.length === 0 && el.textContent?.trim() === groupName && el.offsetParent !== null,
  );
  const group: Element = labelEl
    ? (labelEl.closest('[class*="ProductNewstyle__Group"], [class*="Group"], section, fieldset')
        ?? labelEl.parentElement?.parentElement
        ?? document.body)
    : document.body;
  // 트리거 요소 후보 — readonly input부터 여러 단계 부모까지 시도
  const triggerInput = group.querySelector<HTMLInputElement>('input[type="text"][readonly], input[readonly]');
  const triggerCandidates: HTMLElement[] = [];
  if (triggerInput) {
    triggerCandidates.push(triggerInput);
    let p: HTMLElement | null = triggerInput.parentElement;
    for (let i = 0; i < 4 && p; i++) {
      triggerCandidates.push(p);
      p = p.parentElement;
    }
  }
  const dropdownLike = group.querySelector<HTMLElement>(
    '[class*="select"], [class*="Select"], [class*="dropdown"], [class*="Dropdown"]',
  );
  if (dropdownLike) triggerCandidates.push(dropdownLike);

  if (triggerCandidates.length === 0) {
    return { field: `option:${groupName}`, ok: false, error: '트리거 요소 못 찾음' };
  }

  // picker popup 시각적 가림 (사용자 눈에 안 보이게)
  const cloak = installPickerCloak();

  // 옵션 선택 후 "선택 완료"·"확인"·"적용" 같은 confirm 버튼 자동 클릭
  // (번개장터 사이즈 picker는 chip 클릭만으로 확정 안 되고, 하단 버튼 눌러야 함)
  // 옵션 클릭 → React 리렌더로 버튼이 새 노드로 교체될 수 있으므로
  // 클릭 직전에 다시 쿼리, 재시도까지
  const findConfirmBtn = (): HTMLElement | null => {
    const confirmTexts = ['선택 완료', '선택완료', '확인', '적용', '완료'];
    const btns = [...document.querySelectorAll<HTMLElement>('button, [role="button"]')];
    return btns.find(b => {
      if (b.offsetParent === null && b.getBoundingClientRect().width === 0) return false;
      const t = (b.textContent || '').trim();
      return confirmTexts.some(c => t === c);
    }) ?? btns.find(b => {
      if (b.offsetParent === null && b.getBoundingClientRect().width === 0) return false;
      const t = (b.textContent || '').trim();
      return confirmTexts.some(c => t.includes(c));
    }) ?? null;
  };
  const clickConfirmIfPresent = async (): Promise<boolean> => {
    // 옵션 선택 후 React 리렌더 대기 (버튼이 새로 그려질 시간)
    await wait(150);
    let btn = findConfirmBtn();
    if (!btn) {
      await wait(150);
      btn = findConfirmBtn();
    }
    if (!btn) return false;
    fireOpenSequence(btn);
    // 클릭 후 한번 더 — React가 disabled 상태에서 활성으로 바뀌는 타이밍 대응
    await wait(80);
    const btn2 = findConfirmBtn();
    if (btn2 && btn2 !== btn) {
      // 새로 그려진 버튼이 있으면 한 번 더 클릭
      fireOpenSequence(btn2);
    }
    return true;
  };

  try {
    // 각 후보에 mousedown+mouseup+click 시도하면서 옵션이 나타나는지 확인
    // cloak으로 popup이 보이지 않으니 wait는 최소화 (40~80ms로 충분)
    for (const trig of triggerCandidates) {
      fireOpenSequence(trig);
      await wait(60);
      let opt = findVisibleLeafByText(value);
      if (!opt) {
        // toggle 패턴 — 한 번 더
        fireOpenSequence(trig);
        await wait(80);
        opt = findVisibleLeafByText(value);
      }
      if (opt) {
        // 옵션이 input chip이면 부모 div에도 click 시도 (React onClick이 wrapper에 붙어있을 수 있음)
        fireOpenSequence(opt);
        const parentDiv = opt.parentElement;
        if (parentDiv && opt.tagName === 'INPUT') {
          fireOpenSequence(parentDiv);
        }
        await wait(40);
        // 확정 버튼 ("선택 완료" 등) 자동 클릭
        const confirmed = await clickConfirmIfPresent();
        await wait(40);
        return {
          field: `option:${groupName}`,
          ok: true,
          selector: confirmed
            ? `click<${trig.tagName.toLowerCase()}> → opt:"${value}" → 선택 완료`
            : `click<${trig.tagName.toLowerCase()}> → opt:"${value}"`,
        };
      }
      // 닫고 다음 후보 시도
      document.body.click();
      await wait(40);
    }

    // 모든 트리거 시도 실패 — 문서 전역에 "265"가 있는지 마지막 한 번 더 확인
    const lastTry = findVisibleLeafByText(value);
    if (lastTry) {
      fireOpenSequence(lastTry);
      if (lastTry.tagName === 'INPUT' && lastTry.parentElement) {
        fireOpenSequence(lastTry.parentElement);
      }
      await wait(40);
      await clickConfirmIfPresent();
      return { field: `option:${groupName}`, ok: true, selector: `last-resort → "${value}"` };
    }

    // 디버깅용 — 어떤 텍스트들이 화면에 떠 있는지 console에 기록
    const sample = [...document.querySelectorAll<HTMLElement>('li, button, [role="option"], div, span')]
      .filter(el => el.offsetParent !== null && (el.textContent ?? '').trim().length > 0 && (el.textContent ?? '').trim().length <= 8)
      .slice(0, 50)
      .map(el => `${el.tagName}:"${(el.textContent ?? '').trim()}"`);
    console.warn('[bunjang-helper] 사이즈 옵션 못 찾음. 가시 짧은 텍스트 노드 sample:', sample);

    return {
      field: `option:${groupName}`,
      ok: false,
      error: `드롭다운 트리거 ${triggerCandidates.length}개 모두 시도했으나 "${value}" 옵션 못 찾음 (콘솔에 후보 텍스트 dump됨)`,
    };
  } finally {
    // 어떤 경로로든 cloak 제거 (예외 발생해도 안전)
    cloak.uninstall();
  }
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
async function injectProduct(product: Product, imageData?: InjectImageData[]): Promise<InjectResult[]> {
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
    // 추가 옵션 (사이즈 등) — 카테고리 경로 클릭 후 위젯이 마운트될 시간 확보
    // (옵션은 카테고리 선택 후에야 React가 렌더하므로 충분히 기다려야 함)
    if (product.categoryOptions && Object.keys(product.categoryOptions).length > 0) {
      await wait(400);
      for (const [groupName, value] of Object.entries(product.categoryOptions)) {
        if (!value) continue;
        const fast = injectCategoryOption(groupName, value);
        // ─── 검증 ─── React state가 적용됐는지 60ms 후 확인
        // 적용 안 됐으면 (placeholder만 보이는 readonly input 케이스) 클릭 폴백
        if (fast.ok) {
          await wait(60);
          // 검증: 같은 라벨의 readonly input value가 우리 값과 일치하는지
          const labelEl = [...document.querySelectorAll<HTMLElement>('label, span, div, p')].find(
            el => el.children.length === 0 && el.textContent?.trim() === groupName && el.offsetParent !== null,
          );
          const grp = labelEl?.closest('[class*="ProductNewstyle__Group"], [class*="Group"], section, fieldset')
            ?? labelEl?.parentElement?.parentElement;
          const verifyInput = grp?.querySelector<HTMLInputElement>('input[type="text"][readonly], input[readonly]');
          if (verifyInput && verifyInput.value !== value) {
            // 폴백 — 클릭으로 드롭다운 열어 옵션 선택
            const fallback = await injectCategoryOptionByClick(groupName, value);
            results.push({
              ...fallback,
              selector: `${fast.selector} → 검증실패 → ${fallback.selector ?? fallback.error}`,
            });
          } else {
            results.push(fast);
          }
        } else {
          // fast 자체 실패 — 바로 클릭 폴백 시도
          const fallback = await injectCategoryOptionByClick(groupName, value);
          results.push(fallback.ok ? fallback : fast);
        }
        await wait(120);
      }
    }
  }

  // 이미지 — sidepanel에서 직렬화해 보낸 imageData 우선, 없으면 IndexedDB(같은 origin) 폴백
  if (imageData && imageData.length > 0) {
    try {
      const files = imageData.map(dataUrlToFile);
      results.push(await injectImages(files));
    } catch (e) {
      results.push({ field: 'images', ok: false, error: '이미지 복원 실패: ' + String(e) });
    }
  } else if (product.imgs && product.imgs.length > 0) {
    // ⚠️ content script는 bunjang.co.kr origin이므로 sidepanel(chrome-extension://)이
    // 저장한 IndexedDB에 접근 불가. 정상 경로는 imageData를 통한 전달이며,
    // 이 분기는 호환성용 폴백이다.
    try {
      const filePromises = product.imgs.map(key => loadImageAsFile(key));
      const filesNullable = await Promise.all(filePromises);
      const files = filesNullable.filter((f): f is File => f !== null);
      if (files.length === 0) {
        results.push({
          field: 'images',
          ok: false,
          error: 'IndexedDB에서 이미지를 복원하지 못함 (origin 격리 — sidepanel에서 imageData 전달 필요)',
        });
      } else if (files.length < product.imgs.length) {
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
    injectProduct(msg.product, msg.imageData).then(results => {
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
