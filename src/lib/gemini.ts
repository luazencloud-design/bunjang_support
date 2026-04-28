// Gemini API 클라이언트 — 번개장터 일본 직구 상품명/설명/태그 생성
// 의존성 없이 fetch만 사용 (Chrome 확장 환경)

import { DEFAULT_CATEGORY_TREE } from './bunjang-categories';

// ────────────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────────────

export interface GeminiInput {
  brand: string;
  model: string;
  feature: string;       // 쉼표 구분 자유 텍스트
  condition?: string;    // '새 상품 (미사용)' 등
  cost?: number;         // 엔
  price?: number;        // 원
}

export interface GeminiTitle {
  style: string;         // "최대 검색 노출" 등
  title: string;
}

export interface GeminiOutput {
  titles: GeminiTitle[]; // 5개
  description: string;   // 2~4문장
  tags: string[];        // 최대 5개
  categoryPath: string[]; // [대분류, 중분류, 소분류] — 예: ['가방/지갑', '백팩', '캐주얼백팩']
}

export type GeminiModel = 'flash' | 'pro';

// ────────────────────────────────────────────────────────────────────
// 내부 상수
// ────────────────────────────────────────────────────────────────────

// 신규 사용자에게 gemini-2.0-flash / gemini-1.5-pro 는 더 이상 제공 안 됨 (2025년 정책)
// 2.5 시리즈로 통일
const MODEL_MAP: Record<GeminiModel, string> = {
  flash: 'gemini-2.5-flash',
  pro:   'gemini-2.5-pro',
};

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ────────────────────────────────────────────────────────────────────
// 카테고리 트리 → 프롬프트용 텍스트 (L1: L2, L2, L2 형식)
// ────────────────────────────────────────────────────────────────────
const CATEGORY_TREE_TEXT = DEFAULT_CATEGORY_TREE
  .map(l1 => {
    const l2s = (l1.children ?? []).map(l2 => l2.name).join(', ');
    return l2s ? `${l1.name}: ${l2s}` : l1.name;
  })
  .join('\n');

// ────────────────────────────────────────────────────────────────────
// 프롬프트 생성
// ────────────────────────────────────────────────────────────────────

function buildFullPrompt(input: GeminiInput): string {
  const conditionLine = input.condition ? `- 상품 상태: ${input.condition}` : '';
  const costLine      = input.cost      ? `- 원가: ${input.cost}` : '';
  const priceLine     = input.price     ? `- 판매가: ${input.price}` : '';

  return `당신은 번개장터 셀러의 AI 어시스턴트입니다.
아래 상품 정보를 바탕으로 번개장터 등록에 최적화된 상품명 5개, 설명 초안, 검색 태그, 카테고리를 생성하세요.
매입 출처(국내/해외)나 재고 상태는 신경 쓰지 말고, 주어진 정보로 상품 자체에 집중하세요.

[상품 정보]
- 브랜드: ${input.brand}
- 모델명: ${input.model}
- 주요 특징: ${input.feature}
${conditionLine}
${costLine}
${priceLine}

[상품명 작성 지침]
각 스타일에 맞게 번개장터 검색에 최적화된 상품명을 생성하세요.
- 상품명은 40자 이내로 작성
- 브랜드명과 모델명을 포함하되 자연스럽게 배치
- 한국 소비자가 실제로 검색하는 키워드 활용

[설명 초안 작성 지침]
- 상품 자체의 사실 정보 중심 (브랜드/모델/주요 사양·특징)
- 상품 컨디션을 구체적으로 기술 (흠집, 사용감 등 — 입력된 상태 기준)
- 박스/부속품 포함 여부 (정보 있을 때만)
- 주요 사이즈/스펙 핵심만 간결하게
- 2~4문장으로 작성
- 이모지 사용 금지
- 매입 출처(국내/해외/직구 등) 단정적으로 쓰지 말 것
- 배송 정책, 정품 보증, 반품 안내는 작성하지 마세요 (별도 템플릿으로 추가됨)

[태그 작성 지침]
- 번개장터 검색에 도움되는 핵심 키워드만 선택
- 최대 5개, 브랜드·모델·용도·특징 위주

[카테고리 작성 지침]
아래는 번개장터 실제 카테고리 트리입니다. 반드시 이 목록에서 정확한 명칭을 골라야 합니다.
형식: 대분류: 중분류1, 중분류2, ...

${CATEGORY_TREE_TEXT}

- 위 목록에서 상품에 맞는 대분류와 중분류를 정확히 선택하세요 (철자 동일하게)
- 소분류가 있으면 포함, 없으면 빈 문자열("") 사용
- 반드시 ["대분류", "중분류", "소분류 또는 빈 문자열"] 형태로 정확히 3개 항목 반환

[출력 JSON 스키마]
반드시 아래 스키마를 정확히 따르는 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.
{
  "titles": [
    { "style": "최대 검색 노출", "title": "..." },
    { "style": "간결 직관",      "title": "..." },
    { "style": "한정·희소성",    "title": "..." },
    { "style": "상태·컨디션",    "title": "..." },
    { "style": "원어 병기",      "title": "..." }
  ],
  "description": "...",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
  "categoryPath": ["대분류", "중분류", "소분류"]
}`;
}

function buildTagsPrompt(input: GeminiInput): string {
  return `번개장터 상품의 검색 태그를 생성하세요.

[상품 정보]
- 브랜드: ${input.brand}
- 모델명: ${input.model}
- 주요 특징: ${input.feature}

[지침]
- 번개장터에서 실제 검색에 사용되는 키워드만
- 최대 5개
- 브랜드, 모델, 용도, 특징 위주

[출력 JSON 스키마]
{ "tags": ["태그1", "태그2", "태그3"] }`;
}

// ────────────────────────────────────────────────────────────────────
// API 호출 공통 헬퍼
// ────────────────────────────────────────────────────────────────────

async function callGemini(
  prompt: string,
  apiKey: string,
  modelName: GeminiModel,
): Promise<string> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_NO_KEY');
  }

  const model = MODEL_MAP[modelName];
  const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    // 에러 본문에서 메시지 파싱 시도
    let msg = res.statusText;
    try {
      const errBody = await res.json() as { error?: { message?: string } };
      if (errBody?.error?.message) {
        msg = errBody.error.message;
      }
    } catch {
      // 파싱 실패 시 statusText 그대로 사용
    }
    throw new Error(`GEMINI_HTTP_${res.status}: ${msg}`);
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('GEMINI_PARSE_ERROR');
  }

  return text;
}

// ────────────────────────────────────────────────────────────────────
// 메인 함수 — 상품명 5개 + 설명 + 태그 동시 생성
// ────────────────────────────────────────────────────────────────────

export async function generateProductInfo(
  input: GeminiInput,
  apiKey: string,
  modelName: GeminiModel = 'flash',
): Promise<GeminiOutput> {
  const prompt = buildFullPrompt(input);
  const rawText = await callGemini(prompt, apiKey, modelName);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('GEMINI_PARSE_ERROR');
  }

  // 타입 가드 및 결과 검증
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as GeminiOutput).titles) ||
    typeof (parsed as GeminiOutput).description !== 'string' ||
    !Array.isArray((parsed as GeminiOutput).tags)
  ) {
    throw new Error('GEMINI_PARSE_ERROR');
  }

  const output = parsed as GeminiOutput;

  // titles 길이 검증 — 정확히 5개여야 함
  if (output.titles.length !== 5) {
    throw new Error('GEMINI_PARSE_ERROR');
  }

  // 각 title 항목에 style/title 필드 존재 여부 검증
  for (const item of output.titles) {
    if (
      typeof item.style !== 'string' || item.style.trim() === '' ||
      typeof item.title !== 'string' || item.title.trim() === ''
    ) {
      throw new Error('GEMINI_PARSE_ERROR');
    }
  }

  // tags 최대 5개로 잘라냄 (API가 초과 반환할 경우 대비)
  output.tags = output.tags.slice(0, 5);

  // categoryPath 검증 — 최소 대분류+중분류(2개), 최대 3개
  if (
    !Array.isArray(output.categoryPath) ||
    output.categoryPath.length < 2 ||
    !output.categoryPath.every((item) => typeof item === 'string')
  ) {
    output.categoryPath = [];
  } else {
    // 빈 소분류 제거 (["신발","스니커즈",""] → ["신발","스니커즈"])
    output.categoryPath = output.categoryPath
      .slice(0, 3)
      .filter((s, i) => i < 2 || s.trim() !== '');
  }

  return output;
}

// ────────────────────────────────────────────────────────────────────
// 부수 함수 — 태그만 빠르게 생성 (경량 호출, 별도 버튼용)
// ────────────────────────────────────────────────────────────────────

export async function generateTags(
  input: GeminiInput,
  apiKey: string,
  modelName: GeminiModel = 'flash',
): Promise<string[]> {
  const prompt = buildTagsPrompt(input);
  const rawText = await callGemini(prompt, apiKey, modelName);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('GEMINI_PARSE_ERROR');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { tags: string[] }).tags)
  ) {
    throw new Error('GEMINI_PARSE_ERROR');
  }

  const tags = (parsed as { tags: unknown[] }).tags
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    .slice(0, 5);

  return tags;
}

// ────────────────────────────────────────────────────────────────────
// 이미지 OCR — 택/라벨 사진에서 상품 정보 추출 (Gemini Vision)
// PWA 매장 현장 도구용 — 바코드 대안
// ────────────────────────────────────────────────────────────────────

export interface TagInfo {
  brand?: string;
  model?: string;
  modelCode?: string;       // 예: 'DH7568-100' (Nike SKU)
  size?: string;            // 예: '260' / 'US 9' / 'M'
  color?: string;
  price?: number;
  currency?: 'KRW' | 'JPY' | 'USD';
  category?: string;        // 예: 'sneakers' / 'apparel' / 'cosmetics'
  rawText: string;          // OCR 원본 (사용자 검수용)
}

const TAG_PROMPT = `당신은 상품 택/라벨 사진을 분석해서 구조화된 정보를 추출하는 OCR 전문가입니다.
사진에서 보이는 모든 텍스트를 읽고, 그 중 상품 식별에 필요한 정보를 분류해서 JSON으로 반환하세요.

[추출 대상]
- brand: 브랜드명 (예: Nike, Adidas, Chanel) — 회사/제조사 이름
- model: 제품 라인/시리즈명 (예: Air Force 1, Daybreak, Stan Smith, Cortez, 데이브레이크, デイブレイク)
  ⭐ 가장 중요한 필드 — 사진 어디든 적혀있으면 반드시 추출.
  ⚠️ 절대 brand와 같은 값을 model에 쓰지 마세요. brand="Nike"면 model은 "Nike"가 될 수 없음.
  ⚠️ 한국어/영어/일본어 모두 OK — 보이는 그대로 추출 ("데이브레이크" 또는 "Daybreak" 또는 "デイブレイク")
  ⚠️ NIKE 같은 로고는 보통 크게 박혀있지만 제품명("Daybreak", "Air Force 1")은 작게 적혀있을 수 있음.
       작은 글씨도 꼼꼼히 살펴서 제품명 찾으세요. 박스/택/라벨 어디든.
  ⚠️ 진짜로 사진 어디에도 제품명 안 보일 때만 빈 값. 추측 금지.
- modelCode: 제품 코드/SKU (예: DH7568-100, ID2773, FZ5057-100) — 영문+숫자 조합 패턴
  · model 필드와 다름. modelCode에는 코드만, model에는 사람이 부르는 이름.
- size: 사이즈 (한국 mm 또는 US/UK/EU 표기 그대로)
- color: 색상명 (라벨에 표시된 그대로)
- price: 가격 (숫자만, 통화 기호 제외)
- currency: 가격 통화 — KRW/JPY/USD 중 하나
- category: 추정 카테고리 — sneakers / apparel / cosmetics / electronics / accessories / other
- rawText: 사진에서 읽은 모든 텍스트를 줄바꿈으로 구분 (검수용)

[좋은 예 1 — 신발 풀 정보]
사진에 "NIKE" 로고 + "AIR FORCE 1 '07" + "DH7568-100" 보이면:
{ "brand": "Nike", "model": "Air Force 1 '07", "modelCode": "DH7568-100", ... }

[좋은 예 2 — 제품명 작게]
사진에 큰 "NIKE" 로고 + 작은 글씨로 "Daybreak" + "CK2351-101" 보이면:
{ "brand": "Nike", "model": "Daybreak", "modelCode": "CK2351-101", ... }
(작은 글씨도 놓치지 말 것 — 제품명이 시세 검색의 핵심)

[좋은 예 3 — 한국어/일본어 라벨]
"나이키 데이브레이크" 또는 "ナイキ デイブレイク" 보이면:
{ "brand": "Nike", "model": "데이브레이크", ... }  (또는 "Daybreak" / "デイブレイク")

[나쁜 예 — 절대 이렇게 하지 말 것]
사진에 "NIKE" + "DH7568-100"만 명확히 보이고 제품명 진짜 없을 때:
✗ { "brand": "Nike", "model": "Nike", "modelCode": "DH7568-100" }  ← 중복 잘못
✗ { "brand": "Nike", "model": "DH7568-100", "modelCode": "DH7568-100" }  ← model에 SKU 잘못
✓ { "brand": "Nike", "modelCode": "DH7568-100" }  ← model 비움 (그러면 후속 SKU 조회로 보강함)

[지침]
- 정보가 사진에 명확히 보일 때만 채워라. 추측하지 마라.
- 안 보이는 필드는 생략하거나 빈 문자열로
- 가격이 \`₩45,000\` 형태면 price=45000, currency='KRW'
- 가격이 \`¥8,900\` 또는 \`8,900円\` 형태면 price=8900, currency='JPY'
- 가격이 \`$120\` 형태면 price=120, currency='USD'
- 사이즈는 단위까지 (예: '260' 단독이면 한국식 mm, '260mm'면 그대로, 'US 9'면 'US 9')

[출력 JSON 스키마]
반드시 아래 스키마를 따르는 JSON만 반환. 다른 텍스트 포함 금지.
{
  "brand": "...",
  "model": "...",
  "modelCode": "...",
  "size": "...",
  "color": "...",
  "price": 0,
  "currency": "KRW",
  "category": "...",
  "rawText": "..."
}`;

/**
 * Blob → base64 dataURL (헤더 없이 raw base64만)
 */
async function blobToBase64Raw(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * 택/라벨 사진을 Gemini Vision에 보내서 상품 정보 자동 추출.
 *
 * @param imageBlob  카메라로 촬영한 사진 (image/jpeg 권장)
 * @param apiKey     Gemini API 키
 * @param modelName  'flash' (기본, 빠르고 저렴) | 'pro' (정확도 우선)
 * @returns          구조화된 TagInfo
 * @throws           GEMINI_NO_KEY | GEMINI_HTTP_* | GEMINI_PARSE_ERROR
 */
export async function extractFromTagImage(
  imageBlob: Blob,
  apiKey: string,
  modelName: GeminiModel = 'flash',
): Promise<TagInfo> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_NO_KEY');
  }

  const model = MODEL_MAP[modelName];
  const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const base64 = await blobToBase64Raw(imageBlob);
  const mimeType = imageBlob.type || 'image/jpeg';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: TAG_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2, // 정보 추출은 결정적이어야 — 창작 X
      },
    }),
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const errBody = await res.json() as { error?: { message?: string } };
      if (errBody?.error?.message) msg = errBody.error.message;
    } catch {}
    throw new Error(`GEMINI_HTTP_${res.status}: ${msg}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('GEMINI_PARSE_ERROR');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('GEMINI_PARSE_ERROR');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('GEMINI_PARSE_ERROR');
  }

  const obj = parsed as Record<string, unknown>;
  const result: TagInfo = {
    rawText: typeof obj.rawText === 'string' ? obj.rawText : '',
  };

  // 옵셔널 필드 — 빈 문자열은 생략
  const setStr = (k: keyof TagInfo, v: unknown) => {
    if (typeof v === 'string' && v.trim() !== '') {
      (result as unknown as Record<string, unknown>)[k as string] = v.trim();
    }
  };
  setStr('brand', obj.brand);
  setStr('model', obj.model);
  setStr('modelCode', obj.modelCode);
  setStr('size', obj.size);
  setStr('color', obj.color);
  setStr('category', obj.category);

  if (typeof obj.price === 'number' && obj.price > 0) result.price = obj.price;
  if (obj.currency === 'KRW' || obj.currency === 'JPY' || obj.currency === 'USD') {
    result.currency = obj.currency;
  }

  // Post-processing: Gemini가 자주 저지르는 실수 정리
  // 1) model이 brand와 동일 (예: brand="Nike", model="Nike") → model 제거
  if (result.brand && result.model &&
      result.brand.toLowerCase() === result.model.toLowerCase()) {
    delete result.model;
  }
  // 2) model이 modelCode와 동일 (예: model="DH7568-100", modelCode="DH7568-100") → model 제거
  if (result.model && result.modelCode &&
      result.model.toLowerCase() === result.modelCode.toLowerCase()) {
    delete result.model;
  }
  // 3) model이 SKU 패턴(영문+숫자+하이픈)이고 modelCode 비어있으면 → model을 modelCode로 이동
  if (result.model && !result.modelCode && /^[A-Z0-9]+-?[A-Z0-9]+$/i.test(result.model.replace(/\s/g, ''))) {
    result.modelCode = result.model;
    delete result.model;
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────
// SKU/모델코드로 제품명 조회 — Gemini grounding 활용
// OCR로 model 못 얻었지만 modelCode 있을 때 자동 보강
// 예: brand="Nike" + modelCode="CK2351-101" → "Daybreak" 반환
// ────────────────────────────────────────────────────────────────────

export async function lookupProductName(
  brand: string,
  modelCode: string,
  apiKey: string,
): Promise<string | null> {
  if (!apiKey || apiKey.trim() === '') throw new Error('GEMINI_NO_KEY');
  if (!brand || !modelCode) return null;

  const model = MODEL_MAP.flash;
  const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const prompt = `Google 검색을 활용해 다음 SKU의 공식 제품명만 한 단어/짧은 문구로 알려주세요.

브랜드: ${brand}
SKU/모델코드: ${modelCode}

[지침]
- 제품 라인/시리즈명만 반환 (예: "Daybreak", "Air Force 1", "Stan Smith")
- 브랜드명("Nike", "Adidas")은 제외
- SKU 코드는 제외
- "Nike Air Force 1 LV8" 같은 풀네임에서 브랜드 빼고 → "Air Force 1 LV8"
- 못 찾으면 빈 문자열 ""

[출력 JSON]
{ "productName": "..." }`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text.trim()) return null;

  // JSON 추출
  let jsonStr = text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonMatch) jsonStr = jsonMatch[1];
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }
  try {
    const parsed = JSON.parse(jsonStr) as { productName?: string };
    const name = (parsed.productName || '').trim();
    // brand가 추출 결과에 포함됐으면 제거
    const cleaned = name.replace(new RegExp(`^${brand}\\s+`, 'i'), '').trim();
    // 의미 있는 결과만 반환 (3자 이상, brand 자체가 아님)
    if (cleaned.length < 2) return null;
    if (cleaned.toLowerCase() === brand.toLowerCase()) return null;
    return cleaned;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────
// 시세 조회 — Gemini의 Google Search grounding으로 마켓플레이스별 최근 판매가 추출
// 백엔드 없이 실시간 시세 조회 가능 (사용자 본인 Gemini 키 활용)
// ────────────────────────────────────────────────────────────────────

export type Marketplace = '번개장터' | '당근마켓' | '쿠팡' | '11번가' | '네이버쇼핑' | '메루카리' | '기타';

export interface PriceQuote {
  marketplace: Marketplace | string;
  price: number;
  currency: 'KRW' | 'JPY' | 'USD';
  title?: string;
  url?: string;
  recency?: string; // '최근 7일' / '최근 30일' / '판매중' 등
}

export interface GroundingSource {
  title: string;       // 페이지 제목 (사용자가 식별 가능)
  uri: string;         // grounding URI (Vertex 리다이렉트 — 곧 만료될 수 있음)
}

export interface PriceSearchResult {
  query: string;
  quotes: PriceQuote[];
  sources: GroundingSource[]; // grounding sources (title + URI)
}

// Vertex grounding 리다이렉트는 토큰 수명이 짧고 자주 404 발생.
// 사용자가 클릭해도 실제 페이지 못 봄 → 구글 검색으로 폴백.
function isVertexRedirect(url: string): boolean {
  return url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect');
}

/**
 * Gemini grounding으로 한국·일본 마켓플레이스 시세 조회.
 * google_search 도구로 실시간 웹 검색 → 가격 추출 → JSON 반환.
 *
 * 주의: 결과는 LLM 추출이라 100% 정확하지 않을 수 있음.
 * 비싼 상품일수록 사용자가 출처(sources)에서 직접 확인 권장.
 *
 * @param query   검색어 (예: 'Nike Air Force 1 LV8 DH7568-100')
 * @param apiKey  Gemini API 키
 */
export async function searchPricesViaGemini(
  query: string,
  apiKey: string,
): Promise<PriceSearchResult> {
  if (!apiKey || apiKey.trim() === '') throw new Error('GEMINI_NO_KEY');

  // grounding은 2.5 flash가 가장 가성비 좋음
  const model = MODEL_MAP.flash;
  const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const prompt = `당신은 한국·일본 중고/신품 마켓플레이스의 시세 분석가입니다.
Google 검색을 활용해 다음 상품의 최근 판매가를 마켓플레이스별로 조사하세요.

[상품]
${query}

[조사 대상 마켓플레이스]
- 번개장터 (한국 중고)
- 당근마켓 (한국 중고)
- 쿠팡 (한국 신품)
- 11번가 (한국 신품)
- 네이버쇼핑 (한국 가격비교)
- 메루카리 (일본 중고)

[지침]
- Google 검색 결과에 실제로 노출된 가격만 사용. 추측·평균 계산·창작 금지.
- 같은 마켓플레이스에서 여러 결과 있으면 가장 최근 또는 가장 대표적인 1~2건만.
- 마켓플레이스를 못 찾았으면 그 항목은 생략 (빈 데이터로 채우지 말 것).
- 가격 통화: 번장/당근/쿠팡/11번가/네이버 = KRW, 메루카리 = JPY.
- 결과를 못 찾으면 quotes 빈 배열로.

[출력 JSON 스키마]
오직 JSON만 반환하세요. 다른 텍스트 없이.
{
  "quotes": [
    {
      "marketplace": "번개장터" | "당근마켓" | "쿠팡" | "11번가" | "네이버쇼핑" | "메루카리",
      "price": 45000,
      "currency": "KRW" | "JPY",
      "title": "상품명 (옵션)",
      "url": "출처 URL (옵션)",
      "recency": "판매중" | "최근 7일" | "최근 30일" 등 (옵션)
    }
  ]
}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const errBody = await res.json() as { error?: { message?: string } };
      if (errBody?.error?.message) msg = errBody.error.message;
    } catch {}
    throw new Error(`GEMINI_HTTP_${res.status}: ${msg}`);
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text.trim()) throw new Error('GEMINI_PARSE_ERROR');

  // 응답에서 JSON 부분만 추출 (grounding 모드는 ```json ... ``` 또는 부가 텍스트 섞일 수 있음)
  let jsonStr = text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonMatch) jsonStr = jsonMatch[1];
  // 첫 { ~ 마지막 } 만 시도
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('GEMINI_PARSE_ERROR');
  }

  const obj = parsed as { quotes?: unknown[] };
  const rawQuotes = Array.isArray(obj.quotes) ? obj.quotes : [];

  const quotes: PriceQuote[] = [];
  for (const q of rawQuotes) {
    if (!q || typeof q !== 'object') continue;
    const item = q as Record<string, unknown>;
    if (typeof item.marketplace !== 'string' || typeof item.price !== 'number' || item.price <= 0) continue;
    if (item.currency !== 'KRW' && item.currency !== 'JPY' && item.currency !== 'USD') continue;
    quotes.push({
      marketplace: item.marketplace,
      price: item.price,
      currency: item.currency,
      title: typeof item.title === 'string' ? item.title : undefined,
      url: typeof item.url === 'string' ? item.url : undefined,
      recency: typeof item.recency === 'string' ? item.recency : undefined,
    });
  }

  // grounding sources 추출 — title + uri 모두 수집
  // (Vertex 리다이렉트 URI는 자주 만료되므로 사용자에겐 title 위주로 표시)
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources: GroundingSource[] = chunks
    .map(c => ({
      title: typeof c.web?.title === 'string' ? c.web.title : '',
      uri: typeof c.web?.uri === 'string' ? c.web.uri : '',
    }))
    .filter(s => s.title || s.uri);

  // quote.url에 Vertex 리다이렉트가 있으면 제거 (사용자에게 404만 보여주는 꼴)
  // → undefined로 두면 PWA가 카드 클릭 비활성화
  for (const q of quotes) {
    if (q.url && isVertexRedirect(q.url)) {
      q.url = undefined;
    }
  }

  return { query, quotes, sources };
}
