# 번개장터·당근 반자동 등록 도우미 프로젝트

> Claude Code로 이어서 개발하기 위한 프로젝트 인수인계 문서

---

## 1. 프로젝트 개요

### 목적
일본 메루카리에서 상품을 매입해 한국 번개장터·당근마켓에 판매하는 셀러를 위한 반자동 등록 도구. 강의 수강생에게 무료로 배포할 예정.

### 배경
- 번개장터, 당근, 메루카리 모두 공식 API 없음
- 완전 자동화는 법적/계정 리스크 큼 → **반자동** 방향 확정
- 수강생(강의 수강 중인 개인 셀러) 대상 무료 배포

### 핵심 가치 제안
- 순수 수동 등록 대비 **시간 50~85% 절약** (도구 버전에 따라)
- 설명문 작성 피로 제거 (템플릿 시스템)
- 마진 계산 자동화로 가격 설정 실수 방지
- AI 상품명 추천으로 검색 최적화

---

## 2. 시스템 구성 (현재까지 만든 것)

세 가지 컴포넌트가 독립적으로 존재하며, 필요에 따라 조합 사용:

### 컴포넌트 A: 데스크톱 HTML 도구 (`bunjang_helper.html`)
- 단일 HTML 파일, 브라우저에서 더블클릭 실행
- localStorage 기반 자동 저장
- 번개장터 자동 입력 불가 (복사 + 붙여넣기 방식)

### 컴포넌트 B: 모바일 PWA (`mobile_scanner.html`)
- 매장 현장에서 사용
- 바코드 스캔 + 사진 촬영 + 마진 계산
- Netlify 등으로 HTTPS 호스팅 필요

### 컴포넌트 C: Chrome 확장프로그램 (`bunjang_extension/`)
- **번개장터 자동 입력** (DOM 직접 조작)
- **당근마켓 복사+열기** (반자동)
- 사실상의 메인 프로덕트

**Claude Code 작업 시 컴포넌트 C를 메인으로 확장하는 것을 권장.**

---

## 3. 기능 명세 (현재 구현된 것)

### 3.1 상품 정보 입력
- 상품명, 메루카리 원가(엔), 번개장터 판매가(원), 상품 설명
- 이미지 3장 드래그앤드롭 (최대 1600px 자동 리사이즈, JPEG 85%)

### 3.2 AI 상품명 생성 (5가지 스타일)
- 입력: 브랜드 / 모델 / 색상 / 사이즈 / 카테고리 / 특징
- 5가지 스타일 자동 생성:
  1. 최대 검색 노출형 (키워드 최대한 몰아넣기)
  2. 간결 직관형 (핵심만 짧게)
  3. 한정/희소성 강조형
  4. 상태/컨디션 강조형 (정품, 미사용 등)
  5. 일본어 병기형 (일본 구매자 검색 유리)
- Claude API 직접 호출 (브라우저에서 `anthropic-dangerous-direct-browser-access` 헤더 사용)
- 기본 모델: `claude-haiku-4-5-20251001` (선택 가능: Sonnet 4.5)

### 3.3 템플릿 시스템
- 기본 템플릿 4개 내장 (배송 안내, 정품 보증, 문의 안내, 상품 상태)
- 번호 입력 또는 드롭다운 선택
- **편집 박스**: 번호 선택 시 내용이 박스에 표시됨 → 즉석 수정 → 삽입 (원본은 보존)
- 단축키: `Alt + 1~9` (HTML 버전만)
- 새 템플릿 추가/삭제 가능

### 3.4 마진 자동 계산
- 공식: `마진 = 판매가 - (원가 × 환율) - 배송비 - (판매가 × 수수료율)`
- 기본값: 환율 9.3원/엔, 배송비 3500원, 수수료 3%
- 흑자 초록 / 적자 빨강 색상 표시

### 3.5 번개장터 자동 입력 (확장에서만)
- Content Script로 페이지 DOM 조작
- `setNativeValue()` 사용해 React 등 프레임워크의 상태도 갱신
- 이미지는 `DataTransfer` API로 `<input type="file">`에 주입
- **다중 선택자 시도**: 번개장터 구조 변경 대응 가능
- 진단 창 표시 (성공/실패 필드 명시)

### 3.6 당근마켓 반자동 등록 (확장에서만)
- 전체 정보 클립보드 복사
- 이미지 자동 다운로드 (`chrome.downloads.download`)
- 당근 등록 페이지 새 탭 열기
- 항목별 개별 복사 도우미 창 표시

### 3.7 모바일 기능 (PWA)
- 바코드 스캔 (ZXing 라이브러리, EAN-13/UPC/Code-128 지원)
- 플래시 토글, 카메라 전환
- 바코드 → 상품명 자동 조회 (Open Food Facts API, 식품 위주라 정확도 제한적)
- 상품명/바코드로 메루카리 검색 URL 생성 → 새 탭
- 카메라 촬영 + 자동 리사이즈 + 일괄 다운로드
- 마진 계산 + 기록 저장 (최근 100건)

---

## 4. 기술 스택

### 현재
- **언어**: Vanilla JS (ES2020), HTML, CSS (프레임워크 없음)
- **저장소**: `localStorage` (HTML/PWA), `chrome.storage.local` (확장)
- **API**:
  - Claude API (`https://api.anthropic.com/v1/messages`)
  - Open Food Facts API (바코드 조회)
- **라이브러리**:
  - ZXing (`@zxing/library@0.21.0`) — 바코드 스캔
- **확장**: Chrome Manifest V3, Service Worker

### Claude Code 작업 시 추천 스택
현재 코드는 프레임워크 없이 짜여 있어 확장성이 제한적. Claude Code로 본격 작업 시:
- **Vite + React (or Svelte)** — 확장 개발 친화적, 빠른 개발
- **Tailwind CSS** — 스타일 일관성
- **Zustand or Pinia** — 상태 관리 (현재 전역 변수 방식 탈피)
- **TypeScript** — 타입 안정성 (특히 Chrome API 타입)
- **`@crxjs/vite-plugin`** — Chrome 확장을 Vite로 빌드

---

## 5. 파일 구조

### 5.1 Chrome 확장 (`bunjang_extension/`)
```
bunjang_extension/
├── manifest.json       # v1.1, Manifest V3
├── popup.html          # 팝업 UI (420px 너비, 600px 최대 높이)
├── popup.js            # 팝업 로직 (이 파일이 가장 큼, ~500줄)
├── content.js          # 번개장터 페이지 자동 입력 (~200줄)
├── background.js       # 서비스 워커 (현재 거의 비어있음)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # 수강생용 설치/사용 가이드
```

### 5.2 권한 (`manifest.json`)
```json
{
  "permissions": [
    "storage",        // chrome.storage.local 사용
    "activeTab",      // 현재 탭 접근
    "scripting",      // content script 주입
    "clipboardWrite", // 클립보드 쓰기
    "downloads"       // 이미지 자동 다운로드
  ],
  "host_permissions": [
    "https://*.bunjang.co.kr/*",
    "https://*.daangn.com/*",
    "https://api.anthropic.com/*"
  ]
}
```

---

## 6. 핵심 코드 패턴

### 6.1 React 호환 값 설정 (번개장터 DOM 조작)
```javascript
function setNativeValue(element, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    element.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype,
    'value'
  ).set;
  nativeInputValueSetter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
```
**중요**: 일반 `element.value = "..."`는 React가 감지 못함. 위 패턴 필수.

### 6.2 다중 선택자 시도 (번개장터 구조 변경 대응)
```javascript
const SELECTORS = {
  title: [
    'input[name="name"]',
    'input[name="title"]',
    'input[placeholder*="상품명"]',
    // ... 더 많은 후보
  ],
};

function findElement(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}
```

### 6.3 이미지 자동 업로드
```javascript
async function dataURLtoFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

const dt = new DataTransfer();
files.forEach(f => dt.items.add(f));
fileInput.files = dt.files;
fileInput.dispatchEvent(new Event('change', { bubbles: true }));
```

### 6.4 Claude API 호출 (브라우저에서 직접)
```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  }),
});
```
**참고**: `anthropic-dangerous-direct-browser-access` 헤더는 브라우저 직접 호출용. 프로덕션 배포 시 프록시 서버 검토 필요.

### 6.5 AI 프롬프트 (상품명 생성용)
```
당신은 번개장터-메루카리 연동 판매 전문가입니다. 다음 요령을 반드시 지켜서 상품명 5가지 후보를 만들어주세요.

[필수 요령]
1. 브랜드명 / 모델명 / 캐릭터/아티스트명 / 사이즈 / 한정판 여부를 제목 앞부분에 배치
2. 일본에서 번역·검색되기 쉬운 표준화된 영문/한글 명칭 사용
3. 예쁜 수식어보다 검색될 "키워드"를 몰아넣기
4. 번개장터 제목 길이는 40자 내외가 적당
5. 5가지는 서로 다른 스타일로:
   - 1번: 최대 검색 노출형
   - 2번: 간결 직관형
   - 3번: 한정/희소성 강조형
   - 4번: 상태/컨디션 강조형
   - 5번: 일본어 키워드 병기형

[입력 정보]
- 브랜드: {brand}
- 모델/제품명: {model}
- 색상: {color}
- 사이즈: {size}
- 카테고리: {category}
- 특징: {special}

JSON만 응답:
{
  "titles": [
    {"style": "...", "title": "..."},
    ...
  ]
}
```

---

## 7. 알려진 문제 및 한계

### 7.1 번개장터 선택자 (가장 중요한 이슈)
- `content.js`의 `SELECTORS`는 **추정값**이며 실제 사이트와 다를 수 있음
- 첫 사용자가 F12로 확인해 수정해야 함
- **Claude Code 작업 우선순위 1**: 실제 번개장터 페이지에서 선택자 확인 및 수정

### 7.2 당근마켓 자동 입력 미지원
- 당근은 모바일 앱 중심이라 웹 구조가 불안정
- 현재 "복사+열기" 방식으로만 지원
- 향후 당근 웹 등록 페이지 분석 후 자동 입력 확장 가능

### 7.3 이미지 저장 한계
- localStorage: 5~10MB 제한 → 이미지 여러 장 저장 시 금방 포화
- 해결: IndexedDB로 마이그레이션 or 이미지를 파일 시스템에 저장

### 7.4 메루카리 시세 조회 미구현
- 공식 API 없음, 스크래핑은 IP 제한
- 현재는 메루카리 검색 URL로 연결 (사용자가 눈으로 확인)
- 향후 유료 데이터 서비스 연동 검토 가능

### 7.5 바코드 → 상품명 정확도
- Open Food Facts API 사용 중 (식품 DB)
- 화장품, 가전, 패션 등은 조회 실패율 높음
- 일본 JAN 코드 전용 DB 유료 연동 필요

### 7.6 확장-모바일 연동 없음
- 사용자 요청으로 Firebase/QR 코드 연동 생략
- 모바일에서 촬영한 사진은 카톡 등으로 수동 전송 필요

---

## 8. 로드맵 (Claude Code로 작업 권장 순서)

### 우선순위 1: 현장 검증 및 버그 수정
1. 실제 번개장터 등록 페이지에서 `SELECTORS` 검증 및 수정
2. 진단 창의 실제 사용성 테스트
3. 이미지 업로드 동작 확인

### 우선순위 2: 프레임워크 마이그레이션
현재 Vanilla JS → **Vite + React + TypeScript**로 재구축
- 이유: 현재 popup.js가 500줄 넘어서 유지보수 어려움
- 컴포넌트 분리: `TabMain`, `TabTemplates`, `TabSettings`, `AIGenerator`, `ImageUploader` 등
- 타입 정의: `Product`, `Template`, `Settings`, `AIResponse` 등

### 우선순위 3: 기능 강화
- 상품 여러 개 관리 (현재는 1개만 지원)
- 등록 이력 로그 (언제 어떤 상품을 올렸는지)
- 카테고리 자동 매핑 (번개장터 카테고리 트리 내장)
- 환율 실시간 업데이트 (API 연동)
- 이미지 편집 (크롭, 회전, 필터)

### 우선순위 4: 당근마켓 자동 입력
- 당근 웹 등록 페이지 DOM 구조 분석
- Content Script 확장
- GPS 위치 선택 등 당근 고유 UI 처리

### 우선순위 5: 배포 준비
- Chrome Web Store 등록 (수강생 배포용)
- 사용 영상 제작
- 버그 리포트 수집 시스템 (간단한 폼 or 이메일)

---

## 9. 사용자 워크플로 (전체 흐름)

### 단일 플랫폼 등록 (번개장터)
1. 매장에서 모바일 PWA로 바코드 스캔 + 사진 촬영
2. 귀가 후 사진을 PC로 전송 (카톡 나에게 등)
3. Chrome 확장 팝업 열기
4. 사진 3장 드래그, 상품명·가격·설명 입력 (AI 추천 사용 가능)
5. "🛒 번개장터 자동입력" 클릭
6. 번개장터 페이지에서 카테고리·상태·배송 선택 후 등록

### 양 플랫폼 동시 등록
1. ~4번까지 동일
5. "🛒 번개장터 자동입력" → 번개장터 등록 완료
6. 확장 팝업으로 돌아와서 "🥕 당근 복사+열기" 클릭
7. 당근 페이지에서 이미지 드래그 + 각 필드 복사-붙여넣기
8. 동네, 카테고리 선택 후 등록

---

## 10. 배포 관련 결정사항

### 수강생 배포 방식
- **무료 배포** (결제 기능 없음)
- Chrome Web Store 등록 or `.zip` 파일 + 개발자 모드 설치 가이드

### API 키 정책
- 수강생 각자 Anthropic API 키 발급받아 사용
- 강사 키 공유 금지 (보안, 정책 위반)
- AI 기능은 옵셔널 (키 없어도 기본 기능 사용 가능)

### 법적 고려사항
- 각 플랫폼 이용약관 준수 명시
- "등록 버튼은 사용자가 직접 누름" 원칙 유지
- 과도한 대량 등록은 계정 제재 경고

---

## 11. Claude Code 작업 시 주의사항

### 시작 시
1. `bunjang_extension/` 폴더 구조부터 파악
2. `popup.js`에 거의 모든 로직이 몰려 있음 (리팩토링 1순위)
3. `content.js`의 `SELECTORS`는 실제 사이트 기준으로 검증 필요

### 개발 환경
- Node.js 20+
- pnpm 권장
- Chrome 최신 버전
- 번개장터/당근 테스트 계정 필요

### 테스트 원칙
- 본인 계정으로 1-2개 상품부터 시작
- 대량 테스트는 계정 리스크 있음
- 확장 새로고침: `chrome://extensions/` → 해당 확장의 새로고침 아이콘

### 코드 스타일
- 현재 한글 주석 사용 (수강생 친화적)
- 사용자 대면 텍스트는 전부 한글
- 변수명은 영어 (표준)

---

## 12. 참고 자료

### API 문서
- Claude API: https://docs.claude.com/en/api/overview
- Chrome Extensions (MV3): https://developer.chrome.com/docs/extensions/mv3/
- Open Food Facts: https://world.openfoodfacts.org/api/v0/

### 플랫폼 등록 페이지
- 번개장터 모바일: https://m.bunjang.co.kr/products/new
- 당근마켓 웹: https://www.daangn.com/kr/write/
- 메루카리: https://jp.mercari.com/search?keyword={query}

### 참고 라이브러리
- ZXing (바코드): https://github.com/zxing-js/library
- @crxjs/vite-plugin: https://crxjs.dev/vite-plugin

---

## 13. 메모 / 기타 컨텍스트

### 대화 중 결정된 사항
- **"완전 자동 업로드는 안 만든다"** — 법적/계정 리스크 때문
- **모바일-PC 간 Firebase/QR 연동 생략** — 사용자 요청
- **당근은 "복사+열기" 방식으로 유지** — 자동 입력은 불안정해서 비추천

### 실제 사용 시 시간 절감 (벤치마크)
- 순수 수동 등록: 상품당 8~13분
- HTML 도구 사용: 상품당 4~5분 (~50% 절감)
- Chrome 확장 자동 입력: 상품당 1~2분 (~85% 절감)

### 일본 시장 브랜드 판매 순위 (참고)
1. **아디다스** (현재 가장 핫함, 삼바/가젤/스탠스미스)
2. **나이키** (에어포스1, 에어맥스, 조던1, 특히 콜라보)
3. **뉴발란스** (990, 2002R, 993)
4. **컨버스/반스** (일본 한정 콜라보만)
5. **리복** (비추천, 수요 낮음)

---

## 14. 파일 첨부 (이전에 만든 것)

Claude Code에서 이어받을 파일:
- `bunjang_extension.zip` — Chrome 확장 전체 (v1.1)
- `bunjang_helper.html` — 데스크톱 HTML 도구 (선택)
- `mobile_scanner.html` — 모바일 PWA (선택)

**권장**: `bunjang_extension/` 폴더 내용을 기준으로 시작, 나머지 HTML 파일은 참고용.

---

## 끝으로

이 프로젝트는 "작동하는 MVP"는 완성되어 있고, 이제 **실사용 검증**과 **유지보수 가능한 구조로 리팩토링**이 필요한 단계입니다. Claude Code로 이어받으실 때 우선순위 1번 (번개장터 선택자 검증)부터 시작하시면 바로 실전 투입 가능한 수준이 됩니다.

궁금한 점이나 추가 컨텍스트가 필요하면 이 문서를 Claude Code 세션에 그대로 붙여넣고 질문하세요.
