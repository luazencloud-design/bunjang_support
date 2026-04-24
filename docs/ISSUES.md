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

### #7 [Phase 3] UX 위치 재배치 — `+ 새 상품` 버튼 + 환율 인라인 편집
**우선순위**: 높음 · **대상 브랜치**: feat/phase3-ux

Phase 2 회고에서 발견된 UX 문제 정리.

**문제 1 — "초안 + 이미지 삭제" 버튼이 설정 모달에 묻혀 있음**
- 자주 쓸 기능인데 4단계(⚙ → 스크롤 → 클릭 → 닫기) 진입
- 메인 actionbar 우측에 `+ 새 상품` 아이콘 버튼 신규 추가
- 클릭 시 입력값 있으면 confirm → draft + IndexedDB 이미지 일괄 삭제
- 설정 모달 "초안 관리" 섹션 제거

**문제 2 — 환율이 설정에 있는데 매일 바뀌는 값**
- 배송비/수수료는 정말 안 바뀌니 설정 OK
- 환율은 마진 계산 섹션 헤더에 인라인 노출 + 클릭으로 수정
- 설정 모달에서 환율 행 제거

관련 파일: `src/sidepanel/SidePanel.jsx` (Settings 모달, 마진 계산 섹션, actionbar)

---

### #8 [Phase 3] 템플릿 기능 정리 결정
**우선순위**: 보통 · **블로커**: 사용자 피드백 대기

AI가 설명을 잘 쓰면 템플릿(배송/정품/문의/상태/반품/네고)이 잉여. Phase 3 진입 전 결정 필요.

**옵션:**
- **a. 완전 제거** — UI + Alt+1~9 + 사용자 정의 모두 삭제
- **b. 고정 푸터화** — AI 설명 뒤에 자동 부착되는 1~2개만 (예: 배송 안내, 반품 정책)
- **c. 그대로 유지** — Alt+1~9 단축키 + 사용자 정의 CRUD까지 완성

지인 베타(5~10명) 피드백 후 결정.

---

### #9 [Phase 3/5] API 키 전달 방식 결정 (배포 전략)
**우선순위**: 중간 · **블로커**: PMF 검증

비기술 사용자(나이 지긋한 셀러 포함) 진입 장벽이 핵심 변수.

| 옵션 | 비기술 진입 장벽 | 운영 비용 | 개발 공수 | Web Store |
|------|----------------|----------|----------|----------|
| 1. 본인 키 입력 (현재) | 높음 | 0원 | 0 | OK |
| 4. 하이브리드 (프록시 + 키 토글) | 0 | ~$30/월 (1000명 기준) | 2~3일 | OK + 개인정보 처리방침 |
| 구독 (Free/Pro) | 0 | $30/월 + 결제 수수료 3.3% | 10~13일 | OK + 통신판매업 신고 |

**권장 단계:**
1. Phase 3까지: 옵션 1 유지하면서 베타 피드백 수집
2. 사용자 5~10명 확보 시: 하이브리드 전환
3. 재구매 의사 검증 후: 구독 인프라 구축

자세한 분석: `PLAN.md §9 Phase 3-E`

---

### #3 [Phase 2] Gemini API 실제 연결 + API 키 UI
**우선순위**: 보통 · **대상 브랜치**: feat/phase2-form-ai

- `src/lib/gemini.ts` 생성 — Gemini API 클라이언트
- 브라우저 직접 호출 (별도 CORS 헤더 불필요)
- 설정 패널 API 키 입력 + chrome.storage 저장 (Google AI Studio 키)
- AI 섹션 "상품명 + 설명 생성" 버튼 실 연결 (현재 mock)
- 모델: gemini-2.0-flash (기본) / gemini-1.5-pro (품질 우선)
- 응답: `{ titles: [...], description: "...", tags: [...] }` JSON

참고: `PLAN.md §7.4` Gemini API 호출 패턴 + 프롬프트 방향

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
| ~~chrome.storage 자동 저장 (디바운스)~~ | ~~2~~ | ✅ 완료 (PR #7) |
| ~~태그 자동생성 Gemini API 실 연결~~ | ~~2~~ | ✅ 완료 (PR #7) |
| `+ 새 상품` actionbar 버튼 | 3 | #7 — 설정의 "초안 관리" 대체 |
| 환율 인라인 편집 (마진 섹션) | 3 | #7 — 설정에서 환율 제거 |
| 상태 스트립 실시간 탭 감지 | 3 | background → tab:url 메시지 이미 구현됨 |
| 템플릿 정리 결정 | 3 | #8 — 사용자 피드백 후 a/b/c 택1 |
| 단축키 `Alt+1~9` 템플릿 삽입 | 3 | #8 옵션 c 결정 시 진행 |
| 최근 등록 이력 | 3 | `src/lib/storage.ts` history.add() 활용 |
| 사용자 정의 템플릿 | 3 | #8 옵션 c 결정 시 진행 |
| 카테고리 PC 셀렉터 실측 검증 | 3 | content/bunjang.ts injectCategoryPath() 폴백 의존도 줄이기 |
| API 키 전달 방식 결정 | 3/5 | #9 — 베타 피드백 후 하이브리드 전환 |
| Cloudflare Workers 프록시 (옵션 4) | 5 | 하이브리드 전환 시 |
| Supabase + 포트원 구독 인프라 | 5+ | PMF 검증 후 |
| getUserMedia + ZXing 바코드 | 4 | 모바일 PWA |
| 메루카리 검색 URL 생성 | 4 | 모바일 PWA |
| PWA manifest.webmanifest | 4 | 홈 화면 추가 |
| 확장 아이콘 PNG (16/48/128) | 5 | 배포 준비 |
| Chrome Web Store 등록 | 5 | 배포 준비 |
