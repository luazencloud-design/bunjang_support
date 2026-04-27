# 번개장터 등록 도우미

Chrome **Side Panel** 확장 + 모바일 PWA 스캐너 — 일본 메루카리 매입 → 한국 번개장터 등록 워크플로 자동화.

> 디자인은 Claude Design 산출물 (`design_extract/`) 기반. 코드는 Vite + React + TS + @crxjs.
> 배경/인수인계: [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md)
> 상세 플랜·아키텍처: [`docs/PLAN.md`](docs/PLAN.md)
> 이슈 트래킹: [`docs/ISSUES.md`](docs/ISSUES.md)

---

## 두 가지 산출물

### 1. Chrome 확장 (사이드패널) — 사무실/PC 작업
번개장터 상품 등록 페이지에서 **자동입력 + AI 상품명/설명 + 마진 계산 + 카테고리 자동 선택**. 일본 매입 상품을 빠르게 한국 번개장터에 올림.

### 2. 모바일 PWA — 현장 작업
폰 카메라로 **바코드 스캔 → 시세 비교 → 마진 계산 → 사무실 PC로 전달** (예정). 매장 현장에서 매입 의사결정.

---

## 폴더 구조

```
bunjang/
├── manifest.json              ← Chrome MV3 매니페스트
├── vite.config.ts             ← 확장 빌드 (@crxjs)
├── vite.mobile.config.ts      ← 모바일 PWA 빌드
├── vercel.json                ← Vercel PWA 배포 설정
├── docs/
│   ├── PLAN.md                ← 기술 스택/아키텍처/작업 계획 (단일 진실)
│   ├── PROJECT_HANDOFF.md     ← 프로젝트 배경/인수인계
│   └── ISSUES.md              ← 이슈 트래킹
├── src/
│   ├── sidepanel/             ← 확장 사이드패널 (React)
│   ├── background/            ← 서비스 워커 (메시지 라우팅)
│   ├── content/bunjang.ts     ← 번개장터 DOM 자동입력
│   ├── lib/
│   │   ├── types.ts           ← 공용 타입
│   │   ├── storage.ts         ← chrome.storage 래퍼
│   │   ├── messaging.ts       ← 메시지 헬퍼
│   │   ├── images.ts          ← IndexedDB 이미지 저장
│   │   ├── gemini.ts          ← Gemini API 클라이언트
│   │   ├── fx.ts              ← 환율 자동 조회 (Frankfurter API)
│   │   ├── mercari.ts         ← 메루카리 검색 URL 빌더
│   │   ├── scanner.ts         ← ZXing 바코드 스캔너 래퍼
│   │   └── bunjang-categories.ts ← 카테고리 트리 (하드코딩)
│   └── mobile/                ← PWA
│       ├── index.html
│       ├── main.tsx
│       ├── MobilePWA.jsx
│       └── public/            ← 정적 자산 (manifest, sw, icons)
└── design_extract/            ← Claude Design 원본 (참고)
```

---

## 설치 & 개발

```sh
pnpm install
```

### Chrome 확장 (사이드패널)

```sh
pnpm dev             # Vite dev 서버 (HMR)
pnpm build           # dist/ 출력
```

`chrome://extensions/` → **개발자 모드** → **압축해제된 확장 프로그램 로드** → `dist/` 선택.
툴바 아이콘 클릭 시 사이드 패널이 열립니다.

### 모바일 PWA

```sh
pnpm dev:mobile      # http://localhost:5174 (LAN 노출)
pnpm build:mobile    # dist-mobile/ 출력
pnpm preview:mobile  # 빌드 결과 미리보기
```

폰에서 PWA 설치하려면 **HTTPS 필수**. 두 가지 방법:

**(a) Cloudflare Tunnel** (개발 중 폰 테스트)
```sh
cloudflared tunnel --url http://localhost:5174
# → https://*.trycloudflare.com 발급, 폰 Safari/Chrome에서 열고 "홈 화면 추가"
```

**(b) Vercel** (영구 배포 — 권장)
GitHub repo 푸시 → vercel.com에서 import → 자동 빌드/배포 → `https://*.vercel.app`. `vercel.json` 설정 자동 인식.

---

## 현재 기능 상태

### ✅ Chrome 확장 (사이드패널)
- 번개장터 자동입력 (상품명/가격/설명/사진/태그/배송비/직거래/상품상태/수량)
- 카테고리 3단계 자동 선택 (대/중/소분류) + 사이즈 옵션 (picker cloak로 깜빡임 없이)
- AI 상품명 5종 + 설명 + 태그 + 카테고리 동시 생성 (Gemini 2.5 Flash/Pro)
- IndexedDB 이미지 저장 (사이드패널 origin) → content script로 base64 dataURL 전달 (origin 격리 우회)
- 마진 계산 — 통화 셀렉터 (JPY/USD/KRW), 자동 환율 (Frankfurter API, 6시간 캐시)
- 사용자 정의 템플릿 + Alt+1~9 단축키
- 최근 등록 이력
- 번개장터 카테고리 트리 하드코딩 (스크래핑 X, 일관성 보장)

### ✅ 모바일 PWA
- 카메라 라이브 + 후면 자동 선택 + 카메라 전환
- 바코드 자동 인식 (JAN/EAN/UPC/CODE128/QR/DataMatrix) — ZXing
- 인식 시 진동 알림
- 메루카리 검색 URL 자동 생성 (가격 오름차순 + 판매중 필터)
- 사진 캡처 (최대 6장) + 일괄 다운로드
- 마진 계산 — 확장과 동일한 통화/환율 로직
- 자동 환율 (Frankfurter API)
- 이력 (localStorage, 최근 100건)
- PWA Manifest + Service Worker (오프라인 동작)
- PWA Shortcuts (`?tab=scan` / `?tab=margin` 진입)
- 홈 화면 추가 가능

### ⏳ 진행 예정
- 백엔드 (Supabase) — 현장↔사무실 태스크 큐
- PWA→확장 사진 + 텍스트 전달 (실시간 + 비동기 큐)
- PWA 멀티 검색 (번장/당근/쿠팡/메루카리)
- Chrome Web Store 등록
- 베타 모집 + 피드백
- 카카오 로그인 + 포트원 결제 (PMF 검증 후)

상세 로드맵: [`docs/PLAN.md`](docs/PLAN.md) 9번 섹션 참조.

---

## 디자인 원본

`design_extract/bunjang/project/` 안의 jsx 파일 = 디자인 진실의 원천.
스타일·markup 수정 시에는 디자인 원본과 비교 후 진행.

---

## 라이선스

미정 (사용자 본인 무료 배포 목적).
