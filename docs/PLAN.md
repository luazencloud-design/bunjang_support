# 번개장터 등록 도우미 — 프로젝트 플랜

> 다음 에이전트(또는 미래의 본인)가 이 문서만 보고도 작업을 이어갈 수 있도록 정리한 단일 진실 문서.
>
> - 원본 인수인계 문서: `PROJECT_HANDOFF.md` (이전 세션 컨텍스트, 역사적 배경)
> - 디자인 원본: `design_extract/bunjang/` (Claude Design 산출물)
> - 이 문서: 현재 상태 + 앞으로 할 것 (PROJECT_HANDOFF.md를 부분적으로 대체)

---

## 1. 프로젝트 개요

### 무엇을 만드는가
일본 메루카리에서 매입한 상품을 한국 번개장터에 빠르게 등록하기 위한 **반자동 도구**.
강의 수강생 무료 배포가 목적.

### 두 개의 산출물
1. **Chrome 확장 (Side Panel)** — PC 작업용 메인 프로덕트
2. **모바일 PWA** — 매장 현장에서 바코드 스캔 + 사진 촬영용

### 핵심 가치
- 순수 수동 등록 대비 시간 50~85% 절약
- 마진 계산 자동화로 가격 책정 실수 방지
- AI 상품명 추천으로 검색 노출 최적화
- 템플릿으로 설명문 작성 피로 제거

### 디자인 결정 (변경 금지)
- ✅ Chrome **Side Panel** 사용 (Popup 아님)
- ✅ 메인 컬러 **검정** (`#151515`), 로고 **번개 SVG**
- ✅ Pretendard + Inter + JetBrains Mono 폰트
- ❌ 당근마켓 기능 **완전 제거** (사용자가 명시적으로 빼달라고 함)
- ❌ 완전 자동 업로드 안 만듦 (계정 리스크)
- ❌ 모바일↔PC Firebase/QR 연동 안 함 (사용자 요청)

---

## 2. 기술 스택

### 확정된 것

| 영역 | 기술 | 이유 |
|---|---|---|
| 언어 | **TypeScript** + React JSX | 타입 안정성, 디자인 jsx 그대로 사용 |
| UI | **React 18** | 디자인이 React 기반 |
| 스타일 | **Inline `<style>` + CSS vars** | 디자인 jsx에 박혀있음, 그대로 유지 |
| 번들러 | **Vite 5** + `@crxjs/vite-plugin` v2 beta | 확장 친화적, HMR 지원 |
| 패키지 매니저 | **pnpm** | 빠름, 디스크 효율 |
| 확장 | **Manifest V3** (Side Panel API) | MV2는 deprecated |
| Node | **20+** | Vite 5 요구 |

### 추가 예정 (구현 단계에서)
- **ZXing** (`@zxing/library`) — PWA 바코드 스캔
- **idb** 또는 **idb-keyval** — IndexedDB 래퍼 (이미지 저장용)
- 별도 상태관리 라이브러리 없음 (React state + chrome.storage로 충분)

### 의도적으로 안 쓰는 것
- ❌ Tailwind CSS — 디자인이 inline style이라 충돌
- ❌ Zustand/Redux — 단순한 앱이라 불필요
- ❌ React Router — 사이드패널 한 화면, 모바일 3탭은 state로 처리
- ❌ axios — `fetch`로 충분
- ❌ 별도 디자인 시스템 라이브러리 — 디자인 jsx가 자체 시스템

---

## 3. 아키텍처

### 3.1 Chrome 확장 컨텍스트 (이 프로젝트에서 쓰는 3가지)

> Chrome 확장은 기술적으로 Content Script / Service Worker / Side Panel / Popup(Options) 4가지 컨텍스트를 가질 수 있다. 이 프로젝트는 Popup/Options를 사용하지 않으므로 실제 구현 대상은 3개다.

```
┌────────────────────────────────────────────────────────────┐
│  Tab: bunjang.co.kr (웹페이지)                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  content/bunjang.ts                                  │  │
│  │  - 페이지 DOM 직접 접근                              │  │
│  │  - setNativeValue로 React 인풋에 값 주입             │  │
│  │  - 이미지 DataTransfer로 파일 인풋 채우기            │  │
│  │  - 결과 진단 → background로 send                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↑↓ chrome.tabs.sendMessage        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  background/service-worker.ts                        │  │
│  │  - 메시지 라우팅 (sidepanel ↔ content)               │  │
│  │  - 사이드패널 열기 (action click → openPanel)        │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↑↓ chrome.runtime.sendMessage     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Side Panel (확장 영역)                              │  │
│  │  sidepanel/SidePanel.jsx (React)                     │  │
│  │  - 폼 입력, AI 호출, 템플릿                          │  │
│  │  - 자동입력 버튼 → background로 send                 │  │
│  │  - 진단 결과 수신 → 진단 섹션 업데이트               │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 3.2 데이터 흐름 (자동입력 시나리오)

```
[사용자] 사이드패널에서 폼 입력 → "자동입력" 클릭
   ↓
[SidePanel] chrome.runtime.sendMessage({type:'inject', product})
   ↓
[Background SW] chrome.tabs.sendMessage(activeTab, {type:'inject', product})
   ↓
[Content Script] DOM 셀렉터로 필드 찾고 setNativeValue로 채움
   ↓
[Content Script] 각 필드 성공/실패 결과를 sendResponse로 반환
   ↓
[Background] → SidePanel로 진단 결과 전달
   ↓
[SidePanel] 진단 섹션 업데이트 (✓/✗ + 사용된 셀렉터)
```

### 3.3 모바일 PWA (별도 구조)

```
src/mobile/  (독립 빌드, Netlify 배포 대상)
   ↓
   휴대폰 브라우저에서 접속 → 홈 화면에 추가 → PWA로 사용
   ↓
   getUserMedia → 비디오 스트림 → ZXing 바코드 디코딩
   ↓
   촬영 사진 → Canvas 리사이즈 → IndexedDB 저장 / 다운로드
```

확장과 PWA는 **완전히 독립**. 데이터 공유 없음.

---

## 4. 프로젝트 구조

```
bunjang/
├── README.md                설치/개발 가이드
├── docs/
│   ├── PLAN.md              ← 이 문서 (현재 진실)
│   ├── PROJECT_HANDOFF.md   원본 인수인계 (역사적 컨텍스트)
│   └── ISSUES.md            이슈 트래킹
│
├── package.json             pnpm, scripts
├── pnpm-lock.yaml
├── tsconfig.json            TS 설정 (strict, react-jsx)
│
├── manifest.json            MV3, sidePanel, content_scripts
├── vite.config.ts           확장 빌드 (@crxjs)
├── vite.mobile.config.ts    PWA 빌드 (별도, allowedHosts: true)
│
├── design_extract/          🔒 Claude Design 원본 (수정 금지, 참고용)
│   └── bunjang/
│       ├── README.md
│       ├── chats/chat1.md   디자인 결정의 맥락
│       └── project/
│           ├── Bunjang Helper Designs.html
│           ├── design-canvas.jsx
│           ├── popup.jsx           ← 폐기됨 (사이드패널로 대체)
│           ├── sidepanel.jsx       ← 사이드패널 진실의 원천
│           ├── mobile.jsx          ← PWA 진실의 원천
│           └── ios-frame.jsx       ← 캔버스 프리뷰용
│
└── src/
    ├── sidepanel/                  Chrome Side Panel 진입점
    │   ├── index.html              로드되는 HTML (폰트 import)
    │   ├── main.tsx                React 마운트 + DEFAULT_TWEAKS
    │   └── SidePanel.jsx           디자인 그대로 (React import + export만 추가)
    │
    ├── background/
    │   └── service-worker.ts       MV3 SW (현재: action 클릭 → 사이드패널)
    │
    ├── content/
    │   └── bunjang.ts              번개장터 페이지 주입 (현재: 골격만)
    │
    ├── mobile/                     모바일 PWA 진입점
    │   ├── index.html              PWA 메타 (apple-mobile-web-app)
    │   ├── main.tsx                React 마운트
    │   ├── MobilePWA.jsx           디자인 그대로
    │   └── IOSFrame.jsx            디자인 캔버스용 (PWA 본 빌드에선 미사용)
    │
    ├── lib/                        🔨 (예정) 공용 유틸
    │   ├── gemini.ts               Gemini API 클라이언트
    │   ├── storage.ts              chrome.storage / localStorage 래퍼
    │   ├── messaging.ts            확장 컨텍스트 간 메시지 타입
    │   └── types.ts                Product, Template, AIResponse 등
    │
    └── icons/                      🔨 (예정) 확장 아이콘 PNG
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```

### 디자인 jsx → src/ 옮길 때 규칙
**디자인의 markup·CSS·로직은 절대 수정하지 않는다.** 다음만 변경 허용:
1. 상단: `const { useState, ... } = React;` → `import React, { useState, ... } from 'react';` + 별칭
2. 하단: `window.X = X;` → `export default X;` 또는 `export { ... };`

UI 변경이 필요하면 `design_extract/` 원본을 먼저 수정한다는 정신으로 같이 업데이트.

---

## 5. 기능 요구사항

### 5.1 Chrome Side Panel 기능

#### A. 헤더 영역 (항상 표시)
- [x] 번개 로고 (검정 메탈릭 + 글로스 애니메이션)
- [x] "등록 도우미" 타이틀 + "번개장터" 서브타이틀
- [x] 기록 / 설정 아이콘 버튼 (스프링 회전 호버)
- [ ] 기록 클릭 → 등록 이력 패널 오픈
- [ ] 설정 클릭 → Tweaks (다크모드, 액센트 컬러) 패널 오픈

#### B. 상태 스트립
- [x] 라이브 펄스 닷
- [x] 현재 활성 탭의 URL 실시간 표시 (`chrome.tabs` API)
- [x] 번개장터 페이지일 때만 "● 연결됨" 초록색

#### C. 액션 바 (상단 고정)
- [x] "번개장터 자동입력" 버튼 (검정 + shimmer 호버)
- [x] 클릭 → background → content script → DOM 주입
- [x] 진행 중 로딩 상태 (injecting 상태)
- [ ] 결과 토스트 (진단 섹션에서 확인 가능, 별도 토스트는 Phase 3)

#### D. 상품 섹션
- [x] 이미지 슬롯 3개 (드롭/클릭 영역)
- [ ] 드래그앤드롭으로 이미지 추가
- [ ] 1600px 자동 리사이즈 + JPEG 85% 압축
- [ ] IndexedDB 저장 (localStorage 5MB 제한 회피)
- [x] 상품명 / 원가(¥) / 판매가(₩) / 설명 입력 필드
- [ ] chrome.storage.local 자동 저장 (디바운스)
- [ ] `Alt + 1~9` 단축키로 템플릿 삽입

#### E. 마진 계산 섹션
- [x] 실시간 계산 (원가×환율 + 배송비 + 수수료 → 수익/수익률)
- [x] 흑자/적자 색상 표시 (성공 그린 / 위험 레드)
- [ ] 환율/배송비/수수료 설정 가능 (현재 하드코딩)
- [ ] 환율 실시간 API 연동 (선택)

#### F. AI 상품명 + 설명 생성 섹션
- [x] 5가지 스타일 카드 UI (검색노출/간결/한정/상태/일본어)
- [x] 글자수 배지
- [x] 카드 선택 → "선택한 상품명 적용" 버튼
- [x] AI 생성 설명 미리보기 + 수정 + "설명 적용" 버튼
- [x] 입력 필드: 브랜드/모델/특징
- [ ] 실제 Gemini API 호출 (현재 mock — 상품명·설명·태그 동시 생성)
- [ ] 사용자 API 키 입력/저장 UI (Google AI Studio 키)
- [ ] 모델 선택 (gemini-2.0-flash / gemini-1.5-pro)
- [ ] 에러 핸들링 (키 없음, 한도 초과 등)

**설계 원칙**: AI가 상품명 5개 + 설명 초안 동시 생성 → 사용자가 고르고 수정 → 템플릿(배송/정품/반품 등)을 설명 뒤에 추가 → 자동입력

#### G. 템플릿 섹션
- [x] 6개 기본 템플릿 (배송/정품/문의/상태/반품/네고)
- [x] 클릭 선택 → 편집 textarea → "설명에 삽입" 버튼
- [ ] 사용자 정의 템플릿 추가/수정/삭제
- [ ] chrome.storage.local 영속화

#### H. 자동입력 진단 섹션
- [x] 필드별 ✓/✗ 표시
- [x] 사용된 셀렉터 표시
- [x] 실제 content script 결과 수신 (Phase 1 완료)
- [ ] 실패 필드 클릭 → 페이지 해당 위치로 스크롤

#### I. 최근 등록 섹션
- [ ] 등록 완료한 상품 리스트 (썸네일, 제목, 시각)
- [ ] 클릭 → 폼에 다시 로드 (재등록용)

### 5.2 Content Script 기능 (`bunjang.ts`)

- [x] `setNativeValue()` 헬퍼 (React 호환 값 설정)
- [x] `SELECTORS` 다중 셀렉터 테이블 (2026-04-23 실페이지 검증 완료)
- [x] 메시지 리스너 (`chrome.runtime.onMessage`)
- [x] 필드별 주입 함수 (title, price, description, quantity, tags, condition, shipping, inPerson)
- [x] 이미지 `DataTransfer` 주입 골격 (실 파일 연동은 Phase 2 IndexedDB 완료 후)
- [x] 태그 주입 (`setNativeValue` + `KeyboardEvent Enter`)
- [x] 상품 상태 radio 주입 (`label.textContent.startsWith()` 방식)
- [x] 결과 객체 반환: `{ field, ok, selector, error? }[]`
- [ ] 카테고리 버튼 (현재 골격만, 2단계 선택 구현 필요)

### 5.3 Background Service Worker

- [x] `setPanelBehavior({ openPanelOnActionClick: true })`
- [x] `chrome.runtime.onMessage` 라우팅 (inject 메시지 중계)
- [x] sidepanel ↔ content script 메시지 중계 (`lastFocusedWindow` 방식)
- [x] 활성 탭 URL 변경 감지 → sidepanel에 알림 (`onUpdated` + `onActivated`)

### 5.4 Mobile PWA 기능

#### A. 스캔 탭
- [x] 비디오 영역 + 스캔 라인 애니메이션 (UI만)
- [ ] `getUserMedia({ video: { facingMode: 'environment' } })`
- [ ] ZXing 바코드 디코더 (EAN-13 / UPC / Code-128)
- [ ] 자동 인식 토글 (수동 트리거 옵션)
- [ ] 플래시 토글 (`MediaTrackConstraints.torch`)
- [ ] 카메라 전후면 전환
- [ ] 인식 후 → Open Food Facts API로 상품명 조회 (식품만 정확)
- [ ] 메루카리 검색 URL 생성 → 새 탭

#### B. 마진 탭
- [x] 원가/판매가 입력 → 실시간 계산
- [ ] 환율 설정 영속화

#### C. 기록 탭
- [x] UI 자리만 있음
- [ ] 최근 100건 표시 (썸네일, 마진, 시각)
- [ ] localStorage 저장 (PWA니까 chrome.storage 못 씀)

#### D. 사진 촬영
- [x] 슬롯 UI
- [ ] `<input type="file" accept="image/*" capture="environment">` 또는 직접 캔버스 캡처
- [ ] 자동 리사이즈 (1600px) + JPEG 85%
- [ ] 일괄 다운로드 (ZIP 또는 개별)

#### E. PWA 메타
- [ ] `manifest.webmanifest` (홈 화면 추가용)
- [ ] Service Worker (오프라인 캐싱, 선택)
- [ ] 아이콘 세트 (192, 512)

---

## 6. 데이터 모델 (TypeScript)

### `src/lib/types.ts` (예정)

```ts
// 상품 (사이드패널 폼 + 모바일 기록)
export interface Product {
  id: string;                      // ulid 또는 timestamp
  title: string;
  cost: number;                    // 엔
  price: number;                   // 원
  desc: string;
  imgs: string[];                  // IndexedDB 키 (base64 직접 저장 금지 — 바이너리는 IndexedDB가 적합, chrome.storage는 텍스트 데이터용)
  brand?: string;
  model?: string;
  category?: string;
  feature?: string;
  createdAt: number;
  registeredAt?: number;           // 번개장터 등록 완료 시각
}

// 템플릿
export interface Template {
  id: string;
  name: string;
  text: string;
  builtin: boolean;                // 기본 6개는 true
}

// 사용자 설정
export interface Settings {
  apiKey?: string;                 // Gemini API 키 (Google AI Studio)
  model: 'flash' | 'pro';         // gemini-2.0-flash | gemini-1.5-pro
  fxRate: number;                  // 환율 (기본 9.3)
  shipping: number;                // 배송비 (기본 3500)
  feeRate: number;                 // 수수료율 (기본 0.03)
  dark: boolean;
  accent: string;                  // CSS 컬러 (기본 '#151515')
  autoScan: boolean;               // PWA 자동 스캔
}

// AI 응답
export interface AITitleResponse {
  titles: { style: string; title: string; len: number }[];
}

// 컨텍스트 간 메시지
export type ExtMessage =
  | { type: 'inject'; product: Product }
  | { type: 'inject:result'; results: InjectResult[] }
  | { type: 'tab:url'; url: string };

export interface InjectResult {
  field: string;
  ok: boolean;
  selector?: string;
  error?: string;
}
```

---

## 7. 핵심 코드 패턴

### 7.1 React 호환 값 설정 (필수)
```ts
// content/bunjang.ts
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el.tagName === 'TEXTAREA'
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
```
**왜 필요한가**: 번개장터는 React 기반. `el.value = ...`만 쓰면 React 내부 state가 갱신 안 됨.

### 7.2 다중 셀렉터 폴백
```ts
const SELECTORS = {
  title: ['input[name="name"]', 'input[name="title"]', 'input[placeholder*="상품명"]'],
  // ...
};
function findFirst(selectors: readonly string[]): Element | null {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}
```
**이유**: 번개장터가 마크업 변경 시 폴백으로 다음 셀렉터 시도.

### 7.3 이미지 파일 주입
```ts
async function setFiles(input: HTMLInputElement, files: File[]) {
  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
```

### 7.4 Gemini API 직접 호출 (브라우저)
```ts
// 모델: gemini-2.0-flash (기본, 빠름) | gemini-1.5-pro (품질 우선)
const model = 'gemini-2.0-flash';
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  }
);
const data = await res.json();
const result = JSON.parse(data.candidates[0].content.parts[0].text);
```
**장점**: 별도 CORS 우회 헤더 불필요. Google AI Studio에서 무료로 API 키 발급 가능.  
**보안 주의**: 사용자 본인 API 키만 사용. 강사 키 공유 금지.

### 7.4.1 AI 생성 프롬프트 방향

**입력**: 브랜드, 모델, 특징, 상품상태, (선택) 이미지 설명

**출력 JSON** (`responseMimeType: 'application/json'`으로 강제):
```json
{
  "titles": [
    { "style": "최대 검색 노출", "title": "..." },
    { "style": "간결 직관",      "title": "..." },
    { "style": "한정·희소성",    "title": "..." },
    { "style": "상태·컨디션",    "title": "..." },
    { "style": "일본어 병기",    "title": "..." }
  ],
  "description": "...",
  "tags": ["태그1", "태그2", "태그3"]
}
```

**설명 초안 생성 지침**:
- 일본 직구 정품 여부 명시
- 상품 컨디션 구체적으로
- 박스/부속품 포함 여부
- 사이즈·스펙 핵심만
- 2~4문장, 이모지 없이 (배송/정품 안내는 템플릿으로 추가하므로 제외)

**템플릿의 역할**: AI 설명 뒤에 붙는 고정 보일러플레이트 (배송 정책, 반품 정책, 정품 보증 등)
→ 매번 AI가 생성할 필요 없는 내용이므로 분리 유지

### 7.5 컨텍스트 간 메시지 (타입 안전)
```ts
// SidePanel.jsx — .jsx 파일이라 TypeScript 문법 불가. 타입 annotation, satisfies 등 모두 쓸 수 없음
// 타입 검사는 messaging.ts에서 하고 SidePanel.jsx에서는 그냥 object literal 전달
chrome.runtime.sendMessage({ type: 'inject', product });

// background/service-worker.ts — .ts 파일이라 타입 사용 가능
// ⚠️ currentWindow: true 쓰지 말 것 — Service Worker엔 "현재 창" 개념 없음 → 항상 빈 배열
chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  if (msg.type === 'inject') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id!, msg, sendResponse);
      // sendResponse는 content script의 응답을 그대로 SidePanel로 전달하는 콜백 체인
    });
    return true; // 비동기 응답 허용
  }
});
```

### 7.6 chrome.storage 래퍼
```ts
// lib/storage.ts
export const storage = {
  get: <T>(key: string): Promise<T | undefined> =>
    chrome.storage.local.get(key).then(r => r[key]),
  set: (key: string, value: unknown) =>
    chrome.storage.local.set({ [key]: value }),
};
```

---

## 8. 현재 구현 상태 (정직)

### ✅ 완료 (Phase 1 포함)
- Vite + React + TS + @crxjs 골격 빌드 통과
- 사이드패널 UI 디자인 그대로 렌더 (검정 로고/컬러로 커스터마이즈됨)
- 모바일 PWA UI 디자인 그대로 렌더
- 마진 계산 (실제 동작)
- 템플릿 클릭 → 설명에 삽입 (실제 동작)
- 탭 전환 (모바일)
- localtunnel/ngrok 허용 (`allowedHosts: true`)
- **`src/lib/types.ts`** — Product / Template / Settings / ExtMessage / InjectResult 타입
- **`src/lib/storage.ts`** — chrome.storage.local 래퍼 (draft / templates / settings / history)
- **`src/lib/messaging.ts`** — 타입 안전 메시지 헬퍼
- **`src/content/bunjang.ts`** — SELECTORS 실 검증 완료 (2026-04-23), 메시지 리스너, 필드 주입 함수, 태그/상품상태 주입
- **`src/background/service-worker.ts`** — inject 메시지 라우팅 (`lastFocusedWindow`), 탭 URL 변경 감지
- **`src/sidepanel/SidePanel.jsx`** — 자동입력 버튼 실 연결, 진단 섹션 실데이터, 상태 스트립 실 URL, 태그 입력 + 자동생성, 상품상태 5종 버튼

**Phase 1 전체 동작 검증 완료** (2026-04-23): SW 콘솔 `{type:'inject:result', results: Array(8)}` 응답 확인

### ⚠️ Mock / 가짜 동작
- AI 추천 → 하드코딩 5개 상품명 + aiInputs 기반 템플릿 설명 (Phase 2에서 Gemini API 연결)
- 모바일 바코드 스캔 → setTimeout 시뮬레이션
- 모바일 사진 → SVG 패턴 placeholder
- 이미지 자동입력 → "Phase 2 구현 예정" 메시지 반환

### ❌ 아예 없음
- Gemini API 실제 호출
- 이미지 드래그앤드롭 + IndexedDB 저장
- 입력값 chrome.storage 영속화 (자동 저장)
- 실제 카메라 (`getUserMedia`)
- ZXing 바코드 인식
- 메루카리 검색 연결
- PWA 매니페스트 (홈 화면 추가)
- 확장 아이콘 PNG
- API 키 입력 UI
- 사용자 정의 템플릿 추가/수정/삭제

---

## 9. 작업 우선순위 (다음 에이전트가 따라갈 순서)

### ~~Phase 1 — 핵심 통신~~ ✅ 완료 (2026-04-23)
~~1. **`src/lib/types.ts`** 생성~~
~~2. **`src/lib/messaging.ts`** — 타입 안전 메시지 헬퍼~~
~~3. **`src/lib/storage.ts`** — chrome.storage 래퍼~~
~~4. **Content script 실제 구현** (SELECTORS 검증 포함)~~
~~5. **Background SW 메시지 라우팅**~~
~~6. **SidePanel "자동입력" 버튼 실제 연결**~~
~~7. **진단 섹션 실데이터 표시**~~

### Phase 2 — 폼 영속화 + AI
8. **`src/lib/gemini.ts`** — Gemini API 클라이언트 + 프롬프트
9. **AI 섹션 실제 호출 연결** (mock 제거)
10. **API 키 입력 UI** (설정 패널 신규 구현 필요)
11. **chrome.storage 자동 저장** (디바운스 500ms)
12. **이미지 드래그앤드롭 + 리사이즈 + IndexedDB**

### Phase 3 — UX 강화
13. **상태 스트립** — `chrome.tabs.onUpdated`로 활성 URL 표시
14. **토스트/로딩 상태** 개선
15. **단축키 (`Alt + 1~9`)** 템플릿 삽입
16. **최근 등록 이력** 기록
17. **사용자 정의 템플릿**

### Phase 4 — 모바일 PWA
18. **`getUserMedia` + 비디오 스트림**
19. **ZXing 통합** (`@zxing/library` 추가)
20. **메루카리 검색 URL 생성 + 새 탭**
21. **사진 촬영 + 리사이즈 + 다운로드**
22. **localStorage 기록 저장**
23. **`manifest.webmanifest` + 아이콘**

### Phase 5 — 배포 준비
24. **확장 아이콘 PNG** (16/48/128)
25. **README 사용자용 가이드** (수강생 대상)
26. **Chrome Web Store 등록 또는 zip 배포**
27. **간단한 버그 리포트 폼** (Google Form 등)

---

## 10. 코드 컨벤션

### 파일/폴더
- 디렉토리: kebab-case (`side-panel/`은 안 씀, `sidepanel/`로 통일)
- React 컴포넌트: PascalCase (`SidePanel.jsx`)
- 유틸: camelCase (`storage.ts`, `gemini.ts`)

### 코드
- 디자인 jsx는 **건드리지 않음** (5장 마지막 규칙)
- 새 컴포넌트는 디자인 jsx 옆에 두지 말고 `src/lib/` 또는 `src/sidepanel/_components/` 같은 별도 위치
- 사용자 대면 텍스트는 한글, 변수명은 영어, 주석은 한글 OK
- TypeScript strict, but jsx는 allowJs로 허용 (디자인 그대로 쓰기 위해)

### 커밋
- 짧고 명확하게: `feat: AI 섹션 실제 Gemini API 연결`
- prefix: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`
- 디자인 변경 시 본문에 디자인 원본도 같이 업데이트했는지 명시

---

## 11. 알려진 제약 / 주의사항

### 기술적
- **번개장터 SELECTORS** — 2026-04-23 실페이지 검증 완료. 주기적 재검증 필요 (마크업 변경 위험, ISSUES.md #4 참조)
- **Service Worker 휘발성** — MV3 SW는 5분 idle 후 종료. 상태 유지는 chrome.storage로
- **이미지는 IndexedDB에 저장** — localStorage는 ~5MB(브라우저 강제), chrome.storage.local도 기본 5MB(`unlimitedStorage` 퍼미션으로 해제 가능). 어느 쪽이든 바이너리 데이터는 IndexedDB가 구조적으로 맞음
- **Gemini API 키** — Google AI Studio(aistudio.google.com)에서 무료 발급. 브라우저 직접 호출 시 별도 CORS 헤더 불필요
- **메루카리/번개장터 공식 API 없음** — 스크래핑 위주

### 법적/정책
- 각 플랫폼 이용약관 준수 (등록 버튼은 사용자가 직접 누르는 원칙 유지)
- 과도한 대량 등록은 계정 정지 위험 → 대량 자동화 금지
- 강사가 자기 API 키 공유 금지 (Google AI 정책 위반)

### 사용자 경험
- 사이드패널 폭은 520px (디자인 결정). Chrome 사용자가 폭 조정 가능
- 다크모드 전환 시 일부 컬러는 별도 처리 필요 (디자인에 이미 정의됨)

---

## 12. 개발 환경 / 실행

### 설치
```sh
pnpm install
```

### 확장 개발
```sh
pnpm dev      # Vite + @crxjs HMR 시작
# chrome://extensions/ → 개발자 모드 → dist/ 압축해제 로드
# 툴바 아이콘 클릭 → 사이드패널 오픈
```

### 모바일 PWA 개발
```sh
pnpm dev:mobile   # localhost:5174

# 외부 접근 (휴대폰 테스트):
ngrok http 5174   # 또는 npx localtunnel --port 5174
# 출력 URL을 폰 브라우저에서 열기
```

### 빌드
```sh
pnpm build         # 확장 → dist/
pnpm build:mobile  # PWA → dist-mobile/ (Netlify 등 배포용)
```

### 파일 수정 시 반영
| 파일 | 자동 HMR |
|---|---|
| `SidePanel.jsx`, `MobilePWA.jsx`, CSS | ✅ 즉시 |
| `main.tsx` | ✅ 즉시 |
| `service-worker.ts`, `bunjang.ts`, `manifest.json` | ❌ chrome://extensions/에서 새로고침 클릭 |

---

## 13. 참고 자료

### 공식 문서
- Chrome Side Panel API: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- Chrome Extensions MV3: https://developer.chrome.com/docs/extensions/mv3/
- Gemini API: https://ai.google.dev/gemini-api/docs
- @crxjs Vite Plugin: https://crxjs.dev/vite-plugin
- ZXing JS: https://github.com/zxing-js/library
- Open Food Facts: https://world.openfoodfacts.org/api/v0/

### 플랫폼 페이지
- 번개장터 등록: https://m.bunjang.co.kr/products/new
- 메루카리 검색: https://jp.mercari.com/search?keyword={query}

### 내부 문서
- `PROJECT_HANDOFF.md` — 이전 세션 인수인계 (배경 컨텍스트)
- `design_extract/bunjang/chats/chat1.md` — 디자인 결정 맥락
- `design_extract/bunjang/project/sidepanel.jsx` — UI 진실의 원천
- `design_extract/bunjang/project/mobile.jsx` — 모바일 UI 원천

---

## 끝으로 (다음 에이전트에게)

1. 시작 전 `PLAN.md`(이 문서) → `PROJECT_HANDOFF.md` → 디자인 jsx 순으로 읽으세요.
2. **디자인 jsx는 마크업/스타일/로직 건드리지 마세요.** 변경이 꼭 필요하면 `design_extract/` 원본부터 같이 업데이트.
3. **Phase 1 완료** — SELECTORS 검증, content script, background SW, SidePanel 자동입력 모두 동작 확인됨.
4. **다음 작업은 Phase 2** — Gemini API 실 연결, IndexedDB 이미지 저장, chrome.storage 자동 저장.
5. Mock 데이터는 점진적으로 실데이터로 교체. 한 번에 다 바꾸지 말고 섹션 단위로.
6. 사용자가 명시적으로 거부한 것: **당근마켓, Firebase 연동, 완전 자동 업로드**. 이거 다시 제안하지 마세요.
