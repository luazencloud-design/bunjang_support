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

### #13 [Phase 7] PWA 택 OCR — Gemini Vision으로 상품 정보 자동 추출
**우선순위**: 높음 · **차기 페이즈**

바코드는 한국 매장(특히 아울렛)에서 신발/의류 상품 정보 자동 조회가 어려움 (무료 GS1 DB 없음, 신발은 사이즈별 다른 코드, 아울렛은 단종 모델 多). 택 사진 OCR이 더 실용적.

**기술**: Gemini Vision (확장에 이미 통합)
- 무료 1,500회/일, 한국어/일본어/영어 동시
- OCR + 의미 이해 (사이즈/색상/모델코드/가격 자동 구분)
- JSON 응답 강제

**구현 분량**: 2시간
- `extractFromTagImage(blob, apiKey)` 헬퍼
- PWA에 [📷 택 분석] 버튼 + 결과 카드 자동 채움
- PWA 설정에 Gemini API 키 입력 칸
- 멀티 검색 버튼이 추출된 브랜드+모델 사용

자세한 설계: `PLAN.md §9 Phase 7`

---

### #10 [Phase 8] Supabase 백엔드 + 태스크 큐 시스템
**우선순위**: 높음 · **블로커**: Supabase 프로젝트 셋업 (사용자 액션)

PWA(현장)→확장(사무실) 데이터 전달 — 사진 포함, 비동기, 실시간 알림.

**필요한 컴포넌트:**
- 인증: 매직링크 (이메일)
- DB: workspaces / workspace_members / product_tasks
- Storage: task-photos 버킷 (3일 자동 삭제)
- Realtime: 새 태스크 알림 채널

**설계 원칙 (portable):**
- `src/lib/backend/index.ts` 인터페이스 → `supabase.ts` 구현
- 표준 SQL + S3 호환 API만 사용
- Realtime은 옵션 (폴링 폴백)

**무료 한도**: 하루 100건 처리 시 충분. Pro $25/월로 확장.

자세한 설계: `PLAN.md §9 Phase 7`

---

### #11 [Phase 9] PWA 멀티 검색 (번장/당근/쿠팡/메루카리)
**상태**: ✅ 해결 (PR #10) — 결과 카드에 4개 사이트 + 검색어 input + 마지막 검색어 캐싱

---

### #12 [Phase 10] 베타 모집 + PMF 검증
**우선순위**: 중간 · **블로커**: Phase 6/7/8 완료

- 베타 테스터 5~10명 모집 (한국 셀러 커뮤니티)
- 사용 패턴 모니터링 (Supabase 대시보드 + 직접 인터뷰)
- 버그 픽스 + UX 개선
- 다중 워크스페이스 (피드백 기반)

---

## 닫힌 이슈 (Phase 2~5)

---

### #2 [Phase 2] 이미지 드래그앤드롭 + IndexedDB 저장
**상태**: ✅ 해결 (2026-04-25, Phase 2)

- 사이드패널 이미지 슬롯 드래그앤드롭 ✅
- Canvas 1600px 리사이즈 + JPEG 85% ✅
- IndexedDB 저장 (idb-keyval) ✅
- content script: IndexedDB는 origin 격리되어 있어 sidepanel에서 base64로 직렬화해 전달 ✅

---

### #3 [Phase 2] Gemini API 실제 연결 + API 키 UI
**상태**: ✅ 해결 (2026-04-25, Phase 2)

- `src/lib/gemini.ts` ✅
- 설정 패널 API 키 입력 + chrome.storage ✅
- AI 한 번에 모든 항목 채우기 (titles + description + tags + categoryPath) ✅
- 모델: gemini-2.5-flash / gemini-2.5-pro (2.0/1.5는 신규 사용자 차단됨)

---

### #7 [Phase 3] UX 위치 재배치
**상태**: ✅ 해결 (2026-04-26, Phase 3)

- `+ 새 상품` actionbar 버튼 (IndexedDB 이미지 + chrome.storage 일괄 초기화) ✅
- 환율 인라인 편집 (마진 섹션) ✅
- 설정 모달 정리 ✅

---

### #8 [Phase 3] 템플릿 기능 정리 결정
**상태**: ✅ 해결 (2026-04-26, 옵션 c 채택)

- 옵션 c (그대로 유지 + Alt+1~9 + 사용자 정의 CRUD) 채택
- e.code 기반 (macOS Alt+1=¡ 대응)
- capture phase로 input/textarea 안에서도 동작

---

### #9 [Phase 5] API 키 전달 방식 결정
**상태**: ⚠️ 베타 후 결정 (현재: 옵션 1 — 본인 키)

베타(5~10명) 피드백 후 옵션 4(하이브리드)로 전환 예정. PMF 검증 후 구독 인프라 검토.

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
| 확장 아이콘 PNG (16/48/128) | 6 | 배포 준비 |
| Chrome Web Store 등록 | 6 | 배포 준비 |
| ~~Vercel PWA 배포~~ | ~~6~~ | ✅ 완료 |
| **Gemini Vision 택 OCR (PWA)** | **7** | **#13 — 다음 페이즈** |
| PWA 설정에 Gemini API 키 입력 | 7 | OCR 의존 |
| Supabase 프로젝트 셋업 | 8 | 사용자 액션 (Tokyo region) |
| 백엔드 추상화 레이어 (`src/lib/backend/`) | 8 | portable 설계 |
| 매직링크 인증 (PWA·확장 양쪽) | 8 | Supabase Auth |
| 태스크 큐 DB + Storage + Realtime | 8 | #10 |
| 3일 자동 삭제 (pg_cron) | 8 | Supabase 콘솔 |
| ~~PWA 멀티 검색 (번장/당근/쿠팡/메루카리)~~ | ~~9~~ | ✅ 완료 (PR #10) |
| 통계 대시보드 (일별 처리량) | 9 | |
| 태스크 거절/재할당 | 9 | |
| 베타 5~10명 모집 | 10 | #12 |
| Cloudflare Workers 프록시 (옵션 4 — 하이브리드 API 키) | 11 | PMF 검증 후 |
| 카카오 OAuth | 11 | 한국인 친화적 |
| 포트원 결제 + 월 구독 | 11 | PMF 검증 후 |
| 사업자등록 + 통신판매업 신고 + 약관/개인정보 처리방침 | 11 | 결제 사업화 시 |
