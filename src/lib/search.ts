// 멀티 사이트 검색 URL 빌더
// 바코드/상품명으로 한국·일본 주요 마켓플레이스/리테일 검색 URL 생성
//
// 사용 시나리오:
//   1. 매장에서 바코드 스캔 → 검색어(바코드 또는 사용자가 편집한 상품명)
//   2. 여러 사이트에 동시에 새 탭 열어서 시세 비교
//      - 번장 / 당근 → 한국 중고 시세 (매입·판매가 결정)
//      - 쿠팡 → 한국 신품 시세 (가격대 가늠)
//      - 메루카리 → 일본 buyer가 보게 될 시세 (번장 메루카리 연동 노출가 참고)
//      - 아마존 JP / 요도바시 → 일본어 정식 상품명 확인 (검색어로 재사용)

const enc = (q: string) => encodeURIComponent(q.trim());

export type SearchSite =
  | 'bunjang'    // 번개장터
  | 'daangn'     // 당근마켓
  | 'coupang'    // 쿠팡
  | 'naver'      // 네이버 쇼핑
  | 'mercari'    // 메루카리
  | 'amazonJp'   // 아마존 JP
  | 'yodobashi'  // 요도바시
  | 'google';    // 구글

export interface SiteMeta {
  code: SearchSite;
  label: string;     // UI 표시명 (단어)
  short: string;     // 칩 형태 짧은 표시
  emoji: string;     // 이모지 (시각 구분)
  hint?: string;     // 어떤 용도인지 (tooltip)
}

export const SITES: Record<SearchSite, SiteMeta> = {
  bunjang:   { code: 'bunjang',   label: '번개장터',  short: '번장',     emoji: '⚡', hint: '한국 중고 시세 (경쟁 listing)' },
  daangn:    { code: 'daangn',    label: '당근마켓',  short: '당근',     emoji: '🥕', hint: '한국 중고 시세 (지역)' },
  coupang:   { code: 'coupang',   label: '쿠팡',     short: '쿠팡',     emoji: '🛒', hint: '한국 신품 시세' },
  naver:     { code: 'naver',     label: '네이버 쇼핑', short: '네이버',  emoji: 'N',  hint: '한국 가격 비교' },
  mercari:   { code: 'mercari',   label: '메루카리',  short: '메루카리', emoji: '🇯🇵', hint: '일본 노출가 참고 (번장 메루카리 연동)' },
  amazonJp:  { code: 'amazonJp',  label: '아마존 JP', short: '아마존JP', emoji: '📦', hint: '일본어 정식 상품명 확인' },
  yodobashi: { code: 'yodobashi', label: '요도바시',  short: '요도바시', emoji: '🏪', hint: '일본어 정식 상품명 확인 (가전/뷰티)' },
  google:    { code: 'google',    label: '구글',     short: '구글',     emoji: '🔍', hint: '위 다 안 나올 때 마지막 보루' },
};

// 사이트별 URL 빌더
export function buildSearchUrl(site: SearchSite, query: string): string {
  const q = enc(query);
  switch (site) {
    case 'bunjang':
      return `https://m.bunjang.co.kr/search/products?q=${q}&order=date`;
    case 'daangn':
      return `https://www.daangn.com/search/${q}`;
    case 'coupang':
      return `https://m.coupang.com/nm/search?q=${q}`;
    case 'naver':
      return `https://search.shopping.naver.com/search/all?query=${q}`;
    case 'mercari':
      // 가격 오름차순 + 판매중만
      return `https://jp.mercari.com/search?keyword=${q}&sort=price&order=asc&status=on_sale`;
    case 'amazonJp':
      return `https://www.amazon.co.jp/s?k=${q}`;
    case 'yodobashi':
      return `https://www.yodobashi.com/?word=${q}`;
    case 'google':
      // JAN 검색 시 따옴표로 감싸서 정확 매칭 우선
      return /^\d{8}$|^\d{13}$/.test(query.trim())
        ? `https://www.google.com/search?q=%22${q}%22`
        : `https://www.google.com/search?q=${q}`;
  }
}

// 사이트 클릭 → 새 탭 열기 (편의 함수)
export function openSearchTab(site: SearchSite, query: string): void {
  const url = buildSearchUrl(site, query);
  window.open(url, '_blank', 'noopener');
}

// JAN/EAN 코드 유효성 (단순 길이/숫자 검증)
export function isValidJan(code: string): boolean {
  return /^\d{8}$|^\d{13}$/.test(code.trim());
}

// 워크플로별 추천 사이트 묶음
//   - 'sourcing-kr': 한국에서 매입 → 번장 등록 (메인 워크플로)
//   - 'sourcing-jp': 일본에서 매입 → 번장 등록 (구 워크플로)
//   - 'all': 전체
export const SITE_PRESETS: Record<string, SearchSite[]> = {
  'sourcing-kr': ['bunjang', 'daangn', 'coupang', 'mercari'],
  'sourcing-jp': ['mercari', 'amazonJp', 'yodobashi', 'bunjang'],
  'all':         ['bunjang', 'daangn', 'coupang', 'naver', 'mercari', 'amazonJp', 'yodobashi', 'google'],
};
