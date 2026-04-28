// 신발 사이즈 변환 — US/UK/EU/cm → 한국식 mm
//
// 사이즈 차트는 사실상 변하지 않는 표준이라 하드코딩이 정답.
// (국제 표준 ISO 9407, Mondopoint 기반)
// 브랜드별 미세한 차이는 있지만 Nike·Adidas·Converse·뉴발란스 등 주요 브랜드는
// 거의 동일한 변환표를 따름.
//
// 사용 예:
//   parseSize('US 9')   → { korean: '270mm', original: 'US 9' }
//   parseSize('270')    → { korean: '270mm', original: '270mm' }
//   parseSize('EU 42')  → { korean: '270mm', original: 'EU 42' }
//   parseSize('27cm')   → { korean: '270mm', original: '27cm' }

// ─── 변환 테이블 (남성 기준) ────────────────────────────────
// US Men · UK · EU · Korean mm
// Nike·Adidas 표준 (반사이즈 포함)

interface SizeRow {
  us: number;    // US Men
  uk: number;    // UK
  eu: number;    // EU
  mm: number;    // Korean mm
}

const SIZE_TABLE: SizeRow[] = [
  { us: 5,    uk: 4,    eu: 37.5, mm: 230 },
  { us: 5.5,  uk: 4.5,  eu: 38,   mm: 235 },
  { us: 6,    uk: 5,    eu: 38.5, mm: 240 },
  { us: 6.5,  uk: 5.5,  eu: 39,   mm: 245 },
  { us: 7,    uk: 6,    eu: 40,   mm: 250 },
  { us: 7.5,  uk: 6.5,  eu: 40.5, mm: 255 },
  { us: 8,    uk: 7,    eu: 41,   mm: 260 },
  { us: 8.5,  uk: 7.5,  eu: 42,   mm: 265 },
  { us: 9,    uk: 8,    eu: 42.5, mm: 270 },
  { us: 9.5,  uk: 8.5,  eu: 43,   mm: 275 },
  { us: 10,   uk: 9,    eu: 44,   mm: 280 },
  { us: 10.5, uk: 9.5,  eu: 44.5, mm: 285 },
  { us: 11,   uk: 10,   eu: 45,   mm: 290 },
  { us: 11.5, uk: 10.5, eu: 45.5, mm: 295 },
  { us: 12,   uk: 11,   eu: 46,   mm: 300 },
  { us: 12.5, uk: 11.5, eu: 46.5, mm: 305 },
  { us: 13,   uk: 12,   eu: 47.5, mm: 310 },
  { us: 14,   uk: 13,   eu: 48.5, mm: 320 },
  { us: 15,   uk: 14,   eu: 49.5, mm: 330 },
];

export interface ParsedSize {
  korean: string;     // 'mm' 형태 (예: '270mm') — 한국 표준
  mm: number | null;  // 숫자 (변환 가능 시)
  original: string;   // 사용자 입력 그대로 (검수용)
  source: 'mm' | 'us' | 'uk' | 'eu' | 'cm' | 'unknown'; // 원본 단위
}

/**
 * 다양한 사이즈 표기를 한국식 mm로 변환.
 *
 * 입력 예:
 *   '270', '270mm', '270 mm'          → mm (그대로)
 *   '27', '27cm', '27.0 cm'           → cm → mm (×10)
 *   'US 9', 'US9', 'US 9.5', '9 US'   → US 변환표
 *   'UK 8'                             → UK 변환표
 *   'EU 42', 'EUR 42', '42 EU'        → EU 변환표
 *
 * @param input  사이즈 문자열
 * @returns      파싱 결과 (변환 실패 시 source='unknown', mm=null)
 */
export function parseSize(input: string | null | undefined): ParsedSize {
  if (!input || typeof input !== 'string') {
    return { korean: '', mm: null, original: '', source: 'unknown' };
  }
  const original = input.trim();
  const s = original.toLowerCase().replace(/\s+/g, '').replace(/'/g, '');

  // mm — '270', '270mm', '275mm'
  let m = s.match(/^(\d{2,3}(?:\.\d)?)mm?$/) || s.match(/^(\d{3})$/);
  if (m) {
    const mm = Math.round(parseFloat(m[1]));
    if (mm >= 200 && mm <= 350) {
      return { korean: `${mm}mm`, mm, original, source: 'mm' };
    }
  }

  // cm — '27', '27cm', '27.5cm'
  m = s.match(/^(\d{2}(?:\.\d)?)cm$/) || s.match(/^(\d{2}(?:\.\d)?)$/);
  if (m) {
    const cm = parseFloat(m[1]);
    if (cm >= 20 && cm <= 35) {
      const mm = Math.round(cm * 10);
      return { korean: `${mm}mm`, mm, original, source: 'cm' };
    }
  }

  // US — 'us9', 'us9.5', '9us', 'us-9'
  m = s.match(/^us-?(\d{1,2}(?:\.\d)?)$/) || s.match(/^(\d{1,2}(?:\.\d)?)us$/);
  if (m) {
    const us = parseFloat(m[1]);
    const row = SIZE_TABLE.find((r) => r.us === us);
    if (row) return { korean: `${row.mm}mm`, mm: row.mm, original, source: 'us' };
    // 정확히 일치 안 하면 가장 가까운 값
    const closest = closestRow(SIZE_TABLE, 'us', us);
    if (closest) return { korean: `${closest.mm}mm`, mm: closest.mm, original, source: 'us' };
  }

  // UK — 'uk8'
  m = s.match(/^uk-?(\d{1,2}(?:\.\d)?)$/) || s.match(/^(\d{1,2}(?:\.\d)?)uk$/);
  if (m) {
    const uk = parseFloat(m[1]);
    const row = SIZE_TABLE.find((r) => r.uk === uk);
    if (row) return { korean: `${row.mm}mm`, mm: row.mm, original, source: 'uk' };
    const closest = closestRow(SIZE_TABLE, 'uk', uk);
    if (closest) return { korean: `${closest.mm}mm`, mm: closest.mm, original, source: 'uk' };
  }

  // EU — 'eu42', 'eur42', 'eu42.5'
  m = s.match(/^eur?-?(\d{2}(?:\.\d)?)$/) || s.match(/^(\d{2}(?:\.\d)?)eur?$/);
  if (m) {
    const eu = parseFloat(m[1]);
    const row = SIZE_TABLE.find((r) => r.eu === eu);
    if (row) return { korean: `${row.mm}mm`, mm: row.mm, original, source: 'eu' };
    const closest = closestRow(SIZE_TABLE, 'eu', eu);
    if (closest) return { korean: `${closest.mm}mm`, mm: closest.mm, original, source: 'eu' };
  }

  return { korean: '', mm: null, original, source: 'unknown' };
}

function closestRow(table: SizeRow[], key: keyof SizeRow, value: number): SizeRow | undefined {
  let best: SizeRow | undefined;
  let bestDiff = Infinity;
  for (const row of table) {
    const diff = Math.abs((row[key] as number) - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = row;
    }
  }
  // 0.5 사이즈 이상 차이나면 변환 거부 (잘못된 입력 가능성)
  return bestDiff <= 0.5 ? best : undefined;
}

/**
 * 한국 mm로 변환된 사이즈와 원본을 함께 표시하는 짧은 라벨 생성.
 * 예: '270mm (US 9)' / '270mm' / 'US 9 (변환 실패)'
 */
export function formatSize(parsed: ParsedSize): string {
  if (!parsed.original) return '';
  if (parsed.source === 'unknown' || parsed.mm === null) return parsed.original;
  if (parsed.source === 'mm') return parsed.korean;
  // 변환된 경우 원본도 같이 표시
  return `${parsed.korean} (${parsed.original})`;
}
