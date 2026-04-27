// 메루카리 검색 URL 생성 — 바코드/JAN/타이틀 → 메루카리 검색 페이지
//
// 사용 시나리오:
//   1. 일본 매장에서 바코드 스캔 → JAN 코드 획득
//   2. 메루카리(jp.mercari.com)에서 JAN/제품명으로 시세 조회
//   3. 적정 매입가 판단
//
// 메루카리 검색 URL 패턴:
//   - 일반:    https://jp.mercari.com/search?keyword=<query>
//   - 카테고리: ?category_id=<id>  (선택)
//   - 정렬:    ?sort=price&order=asc  (가격순)
//   - 상태:    ?status=on_sale  (판매중만)

const MERCARI_BASE = 'https://jp.mercari.com/search';
const MERCARI_JP = 'https://www.mercari.com/jp/search';  // 구 URL — fallback용

export interface MercariSearchOptions {
  /** 정렬: 가격순 / 좋아요순 / 최신순 (기본: 좋아요순) */
  sort?: 'price' | 'like' | 'created_time' | 'score';
  /** 정렬 방향 (기본: asc — 저가순) */
  order?: 'asc' | 'desc';
  /** 판매중만 (기본: true) */
  onlyAvailable?: boolean;
  /** 가격 하한 (엔) */
  priceMin?: number;
  /** 가격 상한 (엔) */
  priceMax?: number;
}

/**
 * 검색어로 메루카리 검색 URL 생성.
 *
 * @param query    검색어 (브랜드/제품명/JAN 등 자유 텍스트)
 * @param opts     정렬·필터 옵션
 */
export function buildMercariSearchUrl(
  query: string,
  opts: MercariSearchOptions = {},
): string {
  const params = new URLSearchParams();
  params.set('keyword', query.trim());

  if (opts.sort) params.set('sort', opts.sort);
  if (opts.order) params.set('order', opts.order);
  // 기본: 가격 오름차순 (저가 우선) + 판매중만
  if (!opts.sort) params.set('sort', 'price');
  if (!opts.order) params.set('order', 'asc');
  if (opts.onlyAvailable !== false) params.set('status', 'on_sale');

  if (typeof opts.priceMin === 'number') params.set('price_min', String(opts.priceMin));
  if (typeof opts.priceMax === 'number') params.set('price_max', String(opts.priceMax));

  return `${MERCARI_BASE}?${params.toString()}`;
}

/**
 * JAN/EAN 바코드를 검색어로 변환 (단순 query 검색).
 * 메루카리는 JAN을 직접 인덱싱하지는 않지만, 출품자가 설명에 적는 경우가 많아
 * 키워드로 검색하면 매칭되는 출품을 찾을 수 있다.
 */
export function buildMercariBarcodeUrl(
  jan: string,
  opts: MercariSearchOptions = {},
): string {
  return buildMercariSearchUrl(jan, opts);
}

/**
 * 일본 사이트(yodobashi/amazon.co.jp)에서 JAN 조회 URL — 시세 보조용.
 */
export function buildAmazonJpUrl(jan: string): string {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(jan)}`;
}

export function buildYodobashiUrl(jan: string): string {
  return `https://www.yodobashi.com/?word=${encodeURIComponent(jan)}`;
}

/**
 * JAN 코드 유효성 (단순 길이/숫자 검증).
 * EAN-13 = 13자리, EAN-8 = 8자리, JAN = 13자리(주로) 또는 8자리.
 */
export function isValidJan(code: string): boolean {
  return /^\d{8}$|^\d{13}$/.test(code.trim());
}
