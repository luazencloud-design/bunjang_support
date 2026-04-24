// Gemini API 클라이언트 — 번개장터 일본 직구 상품명/설명/태그 생성
// 의존성 없이 fetch만 사용 (Chrome 확장 환경)

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
// 프롬프트 생성
// ────────────────────────────────────────────────────────────────────

function buildFullPrompt(input: GeminiInput): string {
  const conditionLine = input.condition ? `- 상품 상태: ${input.condition}` : '';
  const costLine      = input.cost      ? `- 원가: ¥${input.cost}` : '';
  const priceLine     = input.price     ? `- 판매가: ₩${input.price}` : '';

  return `당신은 번개장터에서 일본 직구 상품을 판매하는 한국 셀러의 AI 어시스턴트입니다.
아래 상품 정보를 바탕으로 번개장터 등록에 최적화된 상품명 5개, 설명 초안, 검색 태그를 생성하세요.

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
- 일본 정품 직구 상품임을 명시
- 상품 컨디션을 구체적으로 기술 (흠집, 사용감 등)
- 박스/부속품 포함 여부 기재
- 주요 사이즈/스펙 핵심만 간결하게
- 2~4문장으로 작성
- 이모지 사용 금지
- 배송 정책, 정품 보증, 반품 안내는 작성하지 마세요 (별도 템플릿으로 추가됨)

[태그 작성 지침]
- 번개장터 검색에 도움되는 핵심 키워드만 선택
- 최대 5개, 브랜드·모델·용도·특징 위주

[카테고리 작성 지침]
- 번개장터 카테고리 트리에 맞는 대분류/중분류/소분류 3단계 경로 제시
- 대분류 예시: 여성의류, 남성의류, 신발, 가방/지갑, 시계, 쥬얼리, 패션 액세서리, 디지털, 가전, 스포츠, 출산/유아동, 뷰티, 도서/티켓, 가구/인테리어, 식품, 반려동물 등
- 정확한 번개장터 분류명을 사용하되, 모르는 경우 가장 가까운 일반 분류명 사용
- 정확히 3개 항목 ([대, 중, 소])

[출력 JSON 스키마]
반드시 아래 스키마를 정확히 따르는 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.
{
  "titles": [
    { "style": "최대 검색 노출", "title": "..." },
    { "style": "간결 직관",      "title": "..." },
    { "style": "한정·희소성",    "title": "..." },
    { "style": "상태·컨디션",    "title": "..." },
    { "style": "일본어 병기",    "title": "..." }
  ],
  "description": "...",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
  "categoryPath": ["대분류", "중분류", "소분류"]
}`;
}

function buildTagsPrompt(input: GeminiInput): string {
  return `번개장터 일본 직구 상품의 검색 태그를 생성하세요.

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

  // categoryPath 검증 — 유효하지 않으면 빈 배열로 설정 (부분 출력 허용)
  if (
    !Array.isArray(output.categoryPath) ||
    output.categoryPath.length !== 3 ||
    !output.categoryPath.every((item) => typeof item === 'string')
  ) {
    output.categoryPath = [];
  } else {
    output.categoryPath = output.categoryPath.slice(0, 3);
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
