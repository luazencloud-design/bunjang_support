# 번개장터 등록 도우미

Chrome **Side Panel** 확장 + 모바일 PWA 스캐너.

> 디자인은 Claude Design 산출물 (`design_extract/`) 그대로, 코드는 Vite + React + TS + @crxjs로 새로 짜는 중. 자세한 배경은 `PROJECT_HANDOFF.md` 참고.

---

## 폴더 구조

```
bunjang/
├── manifest.json              ← Chrome MV3 매니페스트 (sidePanel)
├── vite.config.ts             ← 확장 빌드 (@crxjs)
├── vite.mobile.config.ts      ← 모바일 PWA 빌드 (별도)
├── src/
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── SidePanel.jsx     ← 디자인 그대로 (React import만 추가)
│   ├── background/
│   │   └── service-worker.ts ← action 클릭 시 사이드패널 오픈
│   ├── content/
│   │   └── bunjang.ts        ← 번개장터 DOM 주입 (TODO)
│   └── mobile/
│       ├── index.html
│       ├── main.tsx
│       ├── MobilePWA.jsx     ← 디자인 그대로
│       └── IOSFrame.jsx      ← 디자인 캔버스용 프레임 (PWA에선 미사용)
└── design_extract/           ← Claude Design 원본 (참고용)
```

## 설치 & 개발

```sh
pnpm install         # 또는 npm install
```

### Chrome 확장 (사이드 패널)

```sh
pnpm dev             # Vite dev 서버 (HMR)
pnpm build           # dist/ 출력
```

`chrome://extensions/` → **개발자 모드** → **압축해제된 확장 프로그램 로드** → `dist/` 선택.
툴바 아이콘 클릭 시 사이드 패널이 열립니다.

### 모바일 PWA

```sh
pnpm dev:mobile      # http://localhost:5174 (LAN 노출)
pnpm build:mobile    # dist-mobile/ 출력 (Netlify 배포용)
```

휴대폰에서 같은 Wi-Fi로 `http://<PC-IP>:5174` 접속 후 홈 화면에 추가.

---

## 작업 상태

### ✅ 완료
- Vite + React + TS + @crxjs 골격
- `SidePanel.jsx` / `MobilePWA.jsx` / `IOSFrame.jsx` 디자인 그대로 임포트
- 매니페스트 + 사이드 패널 엔트리
- 백그라운드 서비스 워커 (action 클릭 → 사이드패널)

### 🔨 남은 작업 (우선순위 순)
1. **번개장터 selector 검증** — `src/content/bunjang.ts`의 `SELECTORS`를 실제 페이지에서 확인
2. **사이드 패널 ↔ content script 메시징** — "자동입력" 버튼 → 번개장터 DOM 주입
3. **진단 결과 수신** — content script → 사이드패널 진단 섹션 업데이트
4. **Claude API 실제 호출** — 현재 AI 섹션은 mock 데이터
5. **chrome.storage.local 영속화** — 입력값/템플릿/설정
6. **다크모드 + 액센트 토글 UI** — 디자인의 Tweaks 패널을 사이드패널 설정에 통합

### ⛔ 디자인 단계에서 제거된 것 (재추가 금지)
- ❌ 당근마켓 자동/반자동 등록 (사용자가 명시적으로 제거)
- ❌ 4탭 popup (사이드 패널로 대체)

---

## 디자인 원본

`design_extract/bunjang/project/` 안의 jsx 파일 = 진실의 원천.
스타일·markup 수정 시에는 디자인 원본과 비교 후 진행.
