// 환율 자동 조회 — Frankfurter API (ECB 기반, API 키 불필요, 무료, CORS 허용)
// 영업일마다 갱신되므로 6시간 캐시면 충분
//
// 응답 예시:
//   GET https://api.frankfurter.dev/v1/latest?base=KRW&symbols=USD,JPY
//   { "amount": 1, "base": "KRW", "date": "2025-04-25",
//     "rates": { "USD": 0.000724, "JPY": 0.108 } }
//
// 변환:
//   1 KRW = 0.000724 USD  →  1 USD = 1/0.000724 ≈ 1381 KRW (fxRateUsd)
//   1 KRW = 0.108 JPY     →  1 JPY = 1/0.108 ≈ 9.26 KRW (fxRateJpy)

const ENDPOINT = 'https://api.frankfurter.dev/v1/latest?base=KRW&symbols=USD,JPY';
const FALLBACK_ENDPOINT = 'https://api.frankfurter.app/latest?from=KRW&to=USD,JPY';

export interface FxRates {
  fxRateJpy: number;
  fxRateUsd: number;
  fetchedAt: number;   // epoch ms
  source: 'frankfurter' | 'fallback';
  date?: string;        // 환율 기준일 (YYYY-MM-DD)
}

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

/**
 * Frankfurter API에서 USD·JPY → KRW 환율 동시 조회.
 * 메인 endpoint 실패 시 fallback (.app) 시도.
 *
 * @throws Error — 양쪽 다 실패하거나 응답 형식이 잘못된 경우
 */
export async function fetchFxRates(): Promise<FxRates> {
  let res: Response;
  let source: FxRates['source'] = 'frankfurter';

  try {
    res = await fetch(ENDPOINT, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    // fallback (구 도메인) 재시도
    source = 'fallback';
    res = await fetch(FALLBACK_ENDPOINT, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Frankfurter API 실패: HTTP ${res.status}`);
  }

  const data = (await res.json()) as FrankfurterResponse;
  const usd = data?.rates?.USD;
  const jpy = data?.rates?.JPY;

  if (typeof usd !== 'number' || usd <= 0 || typeof jpy !== 'number' || jpy <= 0) {
    throw new Error(`Frankfurter 응답 형식 오류: ${JSON.stringify(data?.rates)}`);
  }

  return {
    fxRateUsd: Math.round((1 / usd) * 100) / 100, // 소수점 둘째 자리 반올림 (1381.04)
    fxRateJpy: Math.round((1 / jpy) * 100) / 100, // (9.26)
    fetchedAt: Date.now(),
    source,
    date: data.date,
  };
}

/**
 * 캐시가 maxAgeMs 보다 오래됐으면 새로 가져오고, 아니면 캐시 그대로 반환.
 *
 * @param cached 이전에 가져온 환율 (없으면 무조건 fetch)
 * @param maxAgeMs 최대 캐시 수명 (기본 6시간)
 */
export async function fetchFxRatesIfStale(
  cached: FxRates | null | undefined,
  maxAgeMs: number = 6 * 60 * 60 * 1000,
): Promise<FxRates> {
  if (cached && cached.fetchedAt && Date.now() - cached.fetchedAt < maxAgeMs) {
    return cached;
  }
  return fetchFxRates();
}
