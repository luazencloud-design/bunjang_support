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

### #1 번개장터 자동입력 실사용 테스트 필요
**상태**: PR #5에서 구현 완료, 실사용 테스트 대기 중

자동입력 버튼 → background → content script → DOM 주입 흐름 구현됨.  
실제 번개장터 페이지에서 사용자 테스트 후 최종 확인 필요.

---

## 작업 예정 (이슈 미등록)

| 항목 | Phase | 메모 |
|---|---|---|
| chrome.storage 자동 저장 (디바운스) | 2 | `src/lib/storage.ts` draft.set() 활용 |
| 상태 스트립 실시간 탭 감지 | 3 | background → tab:url 메시지 이미 구현됨 |
| 단축키 `Alt+1~9` 템플릿 삽입 | 3 | KeyboardEvent 리스너 |
| 최근 등록 이력 | 3 | `src/lib/storage.ts` history.add() 활용 |
| 사용자 정의 템플릿 | 3 | templates.save() 활용 |
| getUserMedia + ZXing 바코드 | 4 | 모바일 PWA |
| 메루카리 검색 URL 생성 | 4 | 모바일 PWA |
| PWA manifest.webmanifest | 4 | 홈 화면 추가 |
| 확장 아이콘 PNG (16/48/128) | 5 | 배포 준비 |
| Chrome Web Store 등록 | 5 | 배포 준비 |
