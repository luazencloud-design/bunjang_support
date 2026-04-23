# 이슈 트래킹

GitHub Issues 원본: https://github.com/luazencloud-design/bunjang_support/issues

---

## 열린 이슈

### #4 [크리티컬] 번개장터 마크업 변경 시 SELECTORS 깨짐 위험
**우선순위**: 높음 · **담당**: 주기적 모니터링

번개장터는 styled-components 기반. 배포 시 클래스 해시가 바뀔 수 있고, placeholder 텍스트 변경 시 자동입력 전체 불능.

**현재 리스크**
- `input[placeholder="상품명을 입력해 주세요."]` — placeholder 변경 시 깨짐
- `div[class*="ProductNewstyle__Content"] textarea` — 컴포넌트명 변경 시 깨짐
- 배송비 radio — label 텍스트("배송비포함") 변경 시 깨짐

**대응**
- 진단 섹션의 실패 표시가 첫 신호
- 주기적으로 `m.bunjang.co.kr/products/new` 페이지 점검
- 마지막 검증일: **2026-04-23**

---

### #2 [Phase 2] 이미지 드래그앤드롭 + IndexedDB 저장
**우선순위**: 보통 · **대상 브랜치**: feat/phase2-form-ai

- 사이드패널 이미지 슬롯 드래그앤드롭
- Canvas 1600px 리사이즈 + JPEG 85%
- IndexedDB 저장 (idb-keyval)
- content script: IndexedDB → File → DataTransfer → 번개장터 file input

관련 코드: `src/content/bunjang.ts` `injectImages()` — Phase 2 TODO 주석

---

### #3 [Phase 2] Claude API 실제 연결 + API 키 UI
**우선순위**: 보통 · **대상 브랜치**: feat/phase2-form-ai

- `src/lib/claude.ts` 생성 — API 클라이언트
- 브라우저 직접 호출 (`anthropic-dangerous-direct-browser-access`)
- 설정 패널 API 키 입력 + chrome.storage 저장
- AI 섹션 "재생성" 버튼 실 연결 (현재 mock)
- 모델: Haiku / Sonnet 선택

참고: `PROJECT_HANDOFF.md §6.5` 프롬프트 방향

---

## 닫힌 이슈

### #5 [크리티컬] 자동입력 전혀 작동 안 함 — tabs 퍼미션 누락 + currentWindow 버그
**상태**: ✅ 해결 (2026-04-23) · **커밋**: `bde55ef`, `fde0fa0`

**원인 1 — `manifest.json` `tabs` 퍼미션 누락**
- Background SW에서 `chrome.tabs.query()` 결과의 `tab.url`이 항상 `undefined`
- `"tabs"` 퍼미션 없이는 URL 읽기 불가 (activeTab 단독으로는 부족)
- 결과: "번개장터 페이지가 아님" 에러로 content script 전달 자체 차단

**원인 2 — `currentWindow: true`**
- Service Worker에는 "현재 창" 개념이 없어 항상 빈 배열 반환
- `lastFocusedWindow: true`로 수정

**검증**: SW 콘솔 로그로 `{type: 'inject:result', results: Array(8)}` 응답 확인

---

### #6 [크리티컬] 상품 상태 셀렉터 구조 오판 — radio button이 아닌 button으로 잘못 구현
**상태**: ✅ 해결 (2026-04-23) · **커밋**: `9032e37`

**원인**
- 로그인 없이 페이지 열면 상품상태 섹션 자체가 렌더링 안 됨 → button UI로 잘못 가정
- 실제 DOM은 `label > input[type="radio"]` 구조
- `label.textContent` = "새 상품 (미사용)사용하지 않은 새 상품" (label 텍스트 + 설명 span 합산)
  → `===` 비교 실패, `startsWith()` 필요

**수정**
- `findConditionButton()` → `findConditionRadio()` 로 교체
- `label.textContent.trim().startsWith(conditionText)` 로 매칭
- `types.ts` condition 값 정확한 번개장터 label 텍스트로 확정

---

### #1 번개장터 자동입력 실사용 테스트
**상태**: ✅ 해결 (2026-04-23)

SW 콘솔에서 `results: Array(8)` 응답 확인 — 전체 주입 파이프라인 정상 작동 검증 완료.  
(#5, #6 버그 수정으로 실 동작 달성)

---

## 작업 예정 (이슈 미등록)

| 항목 | Phase | 메모 |
|---|---|---|
| chrome.storage 자동 저장 (디바운스) | 2 | `src/lib/storage.ts` draft.set() 활용 |
| 태그 자동생성 Claude API 실 연결 | 2 | 현재 mock (aiInputs 파싱) → Phase 2에서 실 API 연결 |
| 상태 스트립 실시간 탭 감지 | 3 | background → tab:url 메시지 이미 구현됨 |
| 단축키 `Alt+1~9` 템플릿 삽입 | 3 | KeyboardEvent 리스너 |
| 최근 등록 이력 | 3 | `src/lib/storage.ts` history.add() 활용 |
| 사용자 정의 템플릿 | 3 | templates.save() 활용 |
| getUserMedia + ZXing 바코드 | 4 | 모바일 PWA |
| 메루카리 검색 URL 생성 | 4 | 모바일 PWA |
| PWA manifest.webmanifest | 4 | 홈 화면 추가 |
| 확장 아이콘 PNG (16/48/128) | 5 | 배포 준비 |
| Chrome Web Store 등록 | 5 | 배포 준비 |
