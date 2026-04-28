// MobilePWA.jsx — 모바일 PWA: 카메라 바코드 스캔 → 메루카리 시세 → 마진 계산
// 디자인은 그대로 유지하면서 모든 기능을 실제로 동작하게 연결.
//
// 통신:
//   - 카메라: getUserMedia + ZXing (src/lib/scanner.ts)
//   - 환율:    Frankfurter API (src/lib/fx.ts)
//   - 메루카리: 검색 URL 생성 (src/lib/mercari.ts) → 새 탭 열기
//   - 저장:    localStorage (history, settings) — 확장 IndexedDB와는 분리

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchFxRatesIfStale, fetchFxRates } from '../lib/fx';
import { SITES, SITE_PRESETS, openSearchTab } from '../lib/search';
import { extractFromTagImage } from '../lib/gemini';

// 카메라 캡처 헬퍼 — video 엘리먼트에서 한 프레임을 JPEG Blob으로
function captureFrameToBlob(video) {
  return new Promise((resolve) => {
    if (!video?.videoWidth || !video?.videoHeight) return resolve(null);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve(null);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
  });
}

// ─── localStorage key ──────────────────────────────────────────────
const LS_KEY_HISTORY    = 'bunjang-mobile:history';
const LS_KEY_SETTINGS   = 'bunjang-mobile:settings';
const LS_KEY_FXMETA     = 'bunjang-mobile:fxMeta';
const LS_KEY_LAST_QUERY = 'bunjang-mobile:lastQuery'; // 마지막 편집된 검색어 캐시

// ─── 기본 설정 ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  fxRateJpy: 9.3,
  fxRateUsd: 1380,
  shipping:  3500,
  feeRate:   0.06,
  costCurrency: 'KRW',  // 'JPY' | 'USD' | 'KRW' — 한국 매입이 기본 (필요 시 ¥/$로 변경)
  geminiApiKey: '',     // Gemini API 키 (택 OCR용 — Google AI Studio에서 발급)
};

// ─── CSS ─────────────────────────────────────────────────────────────
const mobileCss = `
  .m-root{
    --bg: #fbfaf7;
    --surface: #ffffff;
    --ink: #1d1a16;
    --ink-2: #5d574d;
    --ink-3: #9a938a;
    --line: rgba(29,26,22,.08);
    --line-2: rgba(29,26,22,.14);
    --chip: #f4f1ec;
    --accent: oklch(68% 0.15 45);
    --success: oklch(60% 0.14 150);
    --danger: oklch(58% 0.18 25);
    font-family: 'Pretendard','Inter', -apple-system, BlinkMacSystemFont, 'SF Pro', system-ui, sans-serif;
    color: var(--ink);
    width: 100%; height: 100%;
    display:flex; flex-direction:column;
    background: var(--bg);
    letter-spacing: -0.015em;
  }
  .m-root.dark{
    --bg: #101011;
    --surface: #1c1c1e;
    --ink: #efece7;
    --ink-2: #a6a39c;
    --ink-3: #6a6762;
    --line: rgba(255,255,255,.08);
    --line-2: rgba(255,255,255,.14);
    --chip: rgba(255,255,255,.07);
  }
  .m-root *{box-sizing:border-box}

  .m-topbar{ display:flex; align-items:center; gap:10px; padding: 6px 20px 10px; }
  .m-topbar h1{ margin:0; font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
  .m-topbar-sub{ color: var(--ink-3); font-size: 13px; font-weight: 500; margin-top: 2px; }
  .m-topbar-icon{
    width: 36px; height: 36px; border-radius: 999px;
    background: var(--chip); display:flex; align-items:center; justify-content:center;
    color: var(--ink-2); border:none;
  }

  .m-segbar{
    margin: 0 16px 12px; padding: 4px;
    background: var(--chip); border-radius: 14px;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;
  }
  .m-seg{
    border:none; background:transparent; padding: 9px 0;
    font-family:inherit; font-size: 13px; font-weight:600;
    color: var(--ink-2); border-radius: 10px;
    display:flex; align-items:center; justify-content:center; gap:6px;
    letter-spacing:-.01em;
  }
  .m-seg.active{ background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.06); }

  .m-body{ flex:1; overflow-y:auto; padding: 0 16px 28px; -webkit-overflow-scrolling: touch; }
  .m-body::-webkit-scrollbar{ display: none; }

  .m-scan{
    position: relative; aspect-ratio: 3/4;
    background: #0a0a0a; border-radius: 20px;
    overflow: hidden; margin-bottom: 14px;
    box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.06);
  }
  .m-scan-video{ position:absolute; inset:0; width:100%; height:100%; object-fit: cover; background: #0a0a0a; }
  .m-scan-overlay{ position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 16px; pointer-events: none; }
  .m-scan-overlay > *{ pointer-events: auto; }
  .m-scan-top{ display: flex; justify-content: space-between; gap: 8px; }
  .m-scan-pill{
    padding: 5px 10px; border-radius: 999px;
    background: rgba(0,0,0,.55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    color: white; font-size: 11px; font-weight: 600;
    display: flex; align-items: center; gap: 6px; letter-spacing: -0.005em;
  }
  .m-scan-pill .live{
    width: 6px; height: 6px; border-radius: 999px;
    background: #ff4d4d; box-shadow: 0 0 6px #ff4d4d;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse{ 50%{opacity:.4} }
  .m-scan-frame{ position: absolute; inset: 0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
  .m-scan-window{ width: 78%; height: 30%; border-radius: 14px; box-shadow: 0 0 0 9999px rgba(0,0,0,.40); position: relative; }
  .m-scan-window::before, .m-scan-window::after, .m-scan-window > i, .m-scan-window > b{
    content:''; position:absolute; width: 24px; height: 24px;
    border: 2.5px solid var(--accent);
  }
  .m-scan-window::before{ top:-2px; left:-2px; border-right:none; border-bottom:none; border-radius: 6px 0 0 0; }
  .m-scan-window::after{ top:-2px; right:-2px; border-left:none; border-bottom:none; border-radius: 0 6px 0 0; }
  .m-scan-window > i{ bottom:-2px; left:-2px; border-right:none; border-top:none; border-radius: 0 0 0 6px; }
  .m-scan-window > b{ bottom:-2px; right:-2px; border-left:none; border-top:none; border-radius: 0 0 6px 0; }
  .m-scan-line{
    position:absolute; left: 5%; right: 5%; top:50%; height: 2px;
    background: linear-gradient(to right, transparent, var(--accent), transparent);
    animation: scan 2.4s ease-in-out infinite;
    box-shadow: 0 0 12px var(--accent);
  }
  @keyframes scan{
    0%,100%{ transform: translateY(-40%); opacity:.3 }
    50%{ transform: translateY(40%); opacity:1 }
  }
  .m-scan-bottom{ display: flex; justify-content: center; gap: 14px; }
  .m-scan-btn{
    width: 48px; height: 48px; border-radius: 999px;
    background: rgba(255,255,255,.18); backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,.25);
    color: white; display:flex; align-items:center; justify-content:center;
  }
  .m-scan-capture{
    width: 64px; height: 64px; border-radius: 999px;
    background: white; border: 4px solid rgba(255,255,255,.3);
    box-shadow: 0 0 0 1px rgba(0,0,0,.1);
  }
  .m-scan-perm{
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    flex-direction:column; gap:14px; padding: 24px; text-align:center;
    color: rgba(255,255,255,.85); font-size: 13.5px; line-height: 1.5;
  }
  .m-scan-perm button{
    background: var(--accent); color: white; border:none;
    padding: 12px 22px; border-radius: 999px;
    font-family: inherit; font-size: 14px; font-weight: 700;
    box-shadow: 0 4px 14px oklch(68% 0.15 45 / 0.4);
  }

  .m-card{
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 16px; padding: 14px; margin-bottom: 12px;
  }
  .m-card-head{ display:flex; align-items:flex-start; gap:10px; margin-bottom: 10px; }
  .m-thumb{
    width: 52px; height: 52px; border-radius: 10px; flex-shrink: 0;
    background-size:cover; background-position:center;
    background-color: var(--chip);
    display:flex; align-items:center; justify-content:center;
    color: var(--ink-3); font-family: 'JetBrains Mono', monospace; font-size: 9.5px;
  }
  .m-card-title{ font-size: 14.5px; font-weight: 600; letter-spacing:-.02em; line-height: 1.3; word-break: break-all; }
  .m-card-meta{ font-size: 11.5px; color: var(--ink-3); margin-top: 3px; font-family: 'JetBrains Mono', 'SF Mono', monospace; }

  .m-margin{
    padding: 16px; border-radius: 16px;
    background:
      linear-gradient(135deg, oklch(68% 0.15 45 / 0.1), oklch(68% 0.15 45 / 0.02)),
      var(--surface);
    border: 1px solid var(--line); margin-bottom: 12px;
  }
  .m-margin-label{ font-size: 12px; color: var(--ink-2); font-weight: 500; }
  .m-margin-value{
    font-family: 'JetBrains Mono','SF Mono', monospace;
    font-variant-numeric: tabular-nums;
    font-size: 40px; font-weight: 700;
    letter-spacing: -0.035em; line-height: 1.1; margin-top: 2px;
  }
  .m-margin-profit.pos{ color: var(--success); }
  .m-margin-profit.neg{ color: var(--danger); }
  .m-margin-pct{
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px; color: var(--ink-3); font-weight: 500; margin-left: 6px;
  }
  .m-fx-status{
    display:flex; justify-content:space-between; align-items:center;
    font-size: 10.5px; color: var(--ink-3); margin-top: 10px;
    padding-top: 8px; border-top: 1px dashed var(--line-2);
  }
  .m-fx-status button{
    border:none; background:transparent; color: var(--accent); font-weight: 700;
    font-size: 11px; cursor: pointer; padding: 2px 6px;
  }

  .m-row{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .m-field{ display:flex; flex-direction:column; gap: 5px; margin-bottom: 10px; }
  .m-field label{ font-size: 12px; font-weight: 500; color: var(--ink-2); }
  .m-num{
    display:flex; align-items:center;
    border: 1px solid var(--line-2); background: var(--surface);
    border-radius: 10px; padding: 2px 14px;
    transition: border .12s, box-shadow .12s;
  }
  .m-num:focus-within{ border-color: var(--accent); box-shadow: 0 0 0 3px oklch(68% 0.15 45 / 0.12); }
  .m-num input{
    flex:1; border:none; outline:none; background:transparent;
    padding: 12px 0; font-size: 18px; font-weight: 600;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    color: var(--ink); min-width:0; letter-spacing: -0.01em;
  }
  .m-num select{
    border: none; background: transparent; outline: none;
    font-family: inherit; font-size: 12px; color: var(--ink-2);
    font-weight: 600; padding: 4px 0 4px 6px; margin-left: 4px;
    border-left: 1px solid var(--line-2);
    appearance: none; -webkit-appearance: none;
  }

  .m-btn{
    border: none; background: var(--chip); color: var(--ink);
    padding: 14px 16px; border-radius: 12px;
    font-family: inherit; font-size: 15px; font-weight: 600;
    display:flex; align-items:center; justify-content:center; gap:8px;
    letter-spacing:-.01em; width: 100%;
  }
  .m-btn:disabled{ opacity: .5; }
  .m-btn.primary{ background: var(--ink); color: white; }
  .m-btn.accent{
    background: var(--accent); color: white;
    box-shadow: 0 2px 10px oklch(68% 0.15 45 / 0.3);
  }
  .m-action-row{ display:flex; gap:8px; margin-bottom: 14px; }
  .m-chip{
    display:inline-flex; align-items:center; gap:4px;
    font-size: 11px; font-weight:600; padding: 3px 8px;
    border-radius: 999px; background: var(--chip); color: var(--ink-2);
  }
  .m-chip.success{ background: oklch(95% 0.05 150); color: oklch(40% 0.12 150); }
  .m-chip.accent{ background: oklch(95% 0.04 45); color: var(--accent); }

  .m-hist-row{
    display:flex; align-items:center; gap:12px;
    padding: 12px 0; border-bottom: 1px solid var(--line);
  }
  .m-hist-row:last-child{ border-bottom: none; }
  .m-hist-info{ flex: 1; min-width: 0; }
  .m-hist-title{ font-size: 14px; font-weight: 600; letter-spacing:-.015em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .m-hist-meta{ font-size: 11px; color: var(--ink-3); margin-top: 2px; font-family:'JetBrains Mono', monospace; }
  .m-hist-profit{
    font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .m-empty{
    text-align:center; padding: 40px 16px; color: var(--ink-3); font-size: 13.5px; line-height: 1.5;
  }

  .m-section-title{
    font-size: 11px; font-weight: 700; color: var(--ink-3);
    text-transform: uppercase; letter-spacing: 0.08em;
    margin: 6px 0 8px; display:flex; align-items:center; justify-content:space-between;
  }

  @keyframes toast-up{
    from{ opacity: 0; transform: translate(-50%, 10px); }
    to{ opacity: 1; transform: translate(-50%, 0); }
  }
  .m-toast{
    position: fixed; left: 50%; bottom: 36px;
    transform: translateX(-50%);
    background: var(--ink); color: white;
    padding: 10px 16px; border-radius: 999px;
    font-size: 13px; font-weight: 600;
    animation: toast-up .2s ease-out;
    display:flex; align-items:center; gap:8px;
    box-shadow: 0 6px 20px rgba(0,0,0,.25);
    z-index: 40; max-width: 86vw;
  }
`;

const MIcon = {
  flash:({s=20}={})=>(<svg width={s} height={s} viewBox="0 0 20 20" fill="none"><path d="M11 2L4 12h5l-1 6 7-10h-5l1-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>),
  flip:({s=20}={})=>(<svg width={s} height={s} viewBox="0 0 20 20" fill="none"><path d="M4 11a6 6 0 0 1 10.5-4M16 9a6 6 0 0 1-10.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M12 6h3V3M8 14H5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  search:({s=16}={})=>(<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  download:({s=16}={})=>(<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 2v9m0 0l3-3m-3 3l-3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  camera:({s=18}={})=>(<svg width={s} height={s} viewBox="0 0 18 18" fill="none"><rect x="2" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/><circle cx="9" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="M6 5l1-2h4l1 2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>),
  history:({s=18}={})=>(<svg width={s} height={s} viewBox="0 0 18 18" fill="none"><path d="M2 9a7 7 0 1 0 2-4.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 2v3h3M9 5v4l2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  barcode:({s=16}={})=>(<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M2 3v10M4 3v10M6 3v10M8.5 3v10M10.5 3v10M13 3v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  check:({s=14}={})=>(<svg width={s} height={s} viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  merc:({s=14}={})=>(<svg width={s} height={s} viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/><text x="7" y="9.5" textAnchor="middle" fontSize="6" fontFamily="monospace" fill="currentColor" fontWeight="700">M</text></svg>),
  refresh:({s=14}={})=>(<svg width={s} height={s} viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 0 1 9-3M12 7a5 5 0 0 1-9 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M9 4h2.5V1.5M5 10H2.5v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>),
};

// ─── 통화 ─────────────────────────────────────────────────────────────
const CURRENCIES = [
  { code: 'JPY', symbol: '¥', label: '엔' },
  { code: 'USD', symbol: '$', label: '달러' },
  { code: 'KRW', symbol: '₩', label: '원' },
];
function toKrw(amount, currency, settings) {
  if (!amount) return 0;
  switch (currency) {
    case 'KRW': return amount;
    case 'USD': return amount * (settings.fxRateUsd || 1380);
    case 'JPY':
    default:    return amount * (settings.fxRateJpy || 9.3);
  }
}

// ─── localStorage 헬퍼 ────────────────────────────────────────────────
function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── 메인 ────────────────────────────────────────────────────────────
function MobilePWA({ tweaks }){
  // URL ?tab= 파라미터 읽어서 초기 탭 결정 (PWA shortcut 지원)
  const initialTab = useMemo(() => {
    const u = new URL(window.location.href);
    const t = u.searchParams.get('tab');
    return ['scan', 'margin', 'history'].includes(t) ? t : 'scan';
  }, []);

  const [tab, setTab] = useState(initialTab);
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...loadJson(LS_KEY_SETTINGS, {}),
  }));
  const [fxMeta, setFxMeta] = useState(() => loadJson(LS_KEY_FXMETA, null));
  const [fxLoading, setFxLoading] = useState(false);

  // 카메라 상태 (스캐너 X — OCR 메인이라 디코드 루프 불필요)
  const [cameraState, setCameraState] = useState('idle'); // 'idle' | 'permission' | 'ready' | 'error'
  const [cameraError, setCameraError] = useState(null);

  // 마진 입력
  const [cost, setCost] = useState(0);
  const [costCurrency, setCostCurrency] = useState(settings.costCurrency || 'JPY');
  const [price, setPrice] = useState(0);

  // 사진 (Blob[])
  const [photos, setPhotos] = useState([]);

  // 이력 (localStorage)
  const [history, setHistory] = useState(() => loadJson(LS_KEY_HISTORY, []));

  // 검색어 — 바코드로 초기화되지만 사용자가 일본어/한글 상품명으로 편집 가능
  // 빈 입력 + 캐시된 마지막 검색어 → 다음 스캔 시 참고용으로 placeholder
  const [searchQuery, setSearchQuery] = useState('');
  const lastSavedQuery = useMemo(() => loadJson(LS_KEY_LAST_QUERY, ''), []);

  // 택 OCR 결과 (Gemini Vision으로 추출한 상품 정보)
  const [tagInfo, setTagInfo] = useState(null);  // { brand, model, size, color, price, currency, ... } | null
  const [ocrLoading, setOcrLoading] = useState(false);

  const [toast, setToast] = useState(null);
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  // 카메라/스캐너 ref
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const fileInputRef = useRef(null);  // 갤러리/폰 카메라 파일 선택용 hidden input

  // ─── 환율 자동 갱신 (mount 시 + 6h 캐시) ───
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = fxMeta && settings.fxRateJpy && settings.fxRateUsd
        ? { fxRateJpy: settings.fxRateJpy, fxRateUsd: settings.fxRateUsd, fetchedAt: fxMeta.fetchedAt, source: fxMeta.source, date: fxMeta.date }
        : null;
      try {
        const fresh = await fetchFxRatesIfStale(cached);
        if (!alive) return;
        if (!cached || fresh.fetchedAt !== cached.fetchedAt) {
          setSettings(s => ({ ...s, fxRateJpy: fresh.fxRateJpy, fxRateUsd: fresh.fxRateUsd }));
          setFxMeta({ fetchedAt: fresh.fetchedAt, source: fresh.source, date: fresh.date });
        }
      } catch (e) {
        console.warn('[mobile] 환율 자동 갱신 실패:', e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // settings/fxMeta 자동 저장
  useEffect(() => { saveJson(LS_KEY_SETTINGS, settings); }, [settings]);
  useEffect(() => { saveJson(LS_KEY_FXMETA, fxMeta); }, [fxMeta]);
  useEffect(() => { saveJson(LS_KEY_HISTORY, history); }, [history]);

  // ─── 카메라 라이프사이클 ───
  // 'scan' 탭일 때만 카메라 활성, 다른 탭으로 가면 즉시 정지 (배터리/프라이버시)
  // 디코드 루프 없이 단순 라이브 프리뷰만 — 사용자가 [택 분석] 또는 [사진] 클릭 시 한 프레임 캡처
  useEffect(() => {
    if (tab !== 'scan') {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      setCameraState('idle');
      return;
    }
    let alive = true;
    (async () => {
      if (!videoRef.current) return;
      setCameraState('permission');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        cameraStreamRef.current = stream;
        setCameraState('ready');
      } catch (e) {
        if (alive) {
          setCameraError(e?.message || String(e));
          setCameraState('error');
        }
      }
    })();
    return () => {
      alive = false;
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [tab]);

  // 카메라 전환 (전면 ↔ 후면)
  async function handleSwitchCamera() {
    if (!cameraStreamRef.current) return;
    const cur = cameraStreamRef.current.getVideoTracks()[0]?.getSettings()?.facingMode;
    const next = cur === 'user' ? 'environment' : 'user';
    cameraStreamRef.current.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      cameraStreamRef.current = stream;
    } catch (e) {
      showToast('카메라 전환 실패: ' + (e?.message || String(e)));
    }
  }

  // ─── 마진 계산 ───
  const margin = useMemo(() => {
    const costKrw = toKrw(cost, costCurrency, settings);
    const fee = price * (settings.feeRate || 0);
    const profit = price - costKrw - (settings.shipping || 0) - fee;
    const pct = price > 0 ? profit / price * 100 : 0;
    return { cost: costKrw, fee, profit, pct };
  }, [cost, costCurrency, price, settings]);

  // ─── 핸들러 ───
  async function handleRefreshFx() {
    if (fxLoading) return;
    setFxLoading(true);
    try {
      const fresh = await fetchFxRates();
      setSettings(s => ({ ...s, fxRateJpy: fresh.fxRateJpy, fxRateUsd: fresh.fxRateUsd }));
      setFxMeta({ fetchedAt: fresh.fetchedAt, source: fresh.source, date: fresh.date });
      showToast(`환율 갱신 — ¥${fresh.fxRateJpy} / $${fresh.fxRateUsd}`);
    } catch (e) {
      showToast('환율 조회 실패');
    } finally {
      setFxLoading(false);
    }
  }

  // 파일 입력 (갤러리 + 폰 기본 카메라 호출) — PWA 라이브 캡처보다 화질·UX 좋음
  // <input type=file accept=image/* multiple>: 모바일에서 "사진/동영상 라이브러리" + "사진 찍기" 옵션 제공
  async function handleFileUpload(e) {
    const files = [...(e.target.files || [])];
    if (files.length === 0) return;
    const remaining = Math.max(0, 6 - photos.length);
    if (remaining === 0) {
      showToast('이미 6장 — 일부 삭제 후 추가하세요');
      return;
    }
    const accepted = files.slice(0, remaining);
    setPhotos(prev => [...prev, ...accepted]);
    showToast(
      accepted.length < files.length
        ? `${accepted.length}장 추가 (한도 6장 초과 ${files.length - accepted.length}장 제외)`
        : `${accepted.length}장 추가됨 · ${photos.length + accepted.length}/6`
    );
    if (navigator.vibrate) navigator.vibrate(40);
    // 같은 파일 다시 선택할 수 있게 input 초기화
    e.target.value = '';
  }

  async function handleCapturePhoto() {
    if (cameraState !== 'ready') {
      showToast('카메라가 활성화되지 않았습니다');
      return;
    }
    const blob = await captureFrameToBlob(videoRef.current);
    if (!blob) {
      showToast('캡처 실패');
      return;
    }
    setPhotos(prev => [...prev, blob].slice(-6));
    showToast(`사진 저장됨 · ${Math.min(photos.length + 1, 6)}/6`);
    if (navigator.vibrate) navigator.vibrate(40);
  }

  // ── 택 분석 — Gemini Vision으로 사진에서 브랜드/모델/사이즈/가격 추출 ──
  async function handleAnalyzeTag() {
    if (ocrLoading) return;
    if (cameraState !== 'ready') {
      showToast('카메라가 활성화되지 않았습니다');
      return;
    }
    if (!settings.geminiApiKey || !settings.geminiApiKey.trim()) {
      showToast('설정에서 Gemini API 키를 입력하세요');
      return;
    }
    const blob = await captureFrameToBlob(videoRef.current);
    if (!blob) {
      showToast('사진 캡처 실패');
      return;
    }
    // 캡처한 사진은 ocr 결과와 별개로 사진 목록에도 추가 (확장으로 보낼 때 사용)
    setPhotos(prev => [...prev, blob].slice(-6));
    setOcrLoading(true);
    try {
      const info = await extractFromTagImage(blob, settings.geminiApiKey);
      setTagInfo(info);
      // 검색어를 자동으로 "브랜드 + 모델"로 채우기
      const composed = [info.brand, info.model].filter(Boolean).join(' ').trim();
      if (composed) {
        setSearchQuery(composed);
        saveJson(LS_KEY_LAST_QUERY, composed);
      }
      // 가격 정보 있으면 마진 계산용 cost로도 채워주기
      if (info.price && info.currency) {
        setCost(info.price);
        setCostCurrency(info.currency);
      }
      showToast(`택 분석 완료 — ${composed || info.brand || '결과 확인'}`);
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg === 'GEMINI_NO_KEY') showToast('Gemini API 키 누락');
      else if (msg.startsWith('GEMINI_HTTP_')) showToast('Gemini API 오류: ' + msg);
      else if (msg === 'GEMINI_PARSE_ERROR') showToast('응답 파싱 실패 — 다시 시도하세요');
      else showToast('택 분석 실패: ' + msg);
    } finally {
      setOcrLoading(false);
    }
  }

  function handleSiteSearch(siteCode) {
    const q = (searchQuery || '').trim();
    if (!q) {
      showToast('검색어가 비어있습니다');
      return;
    }
    saveJson(LS_KEY_LAST_QUERY, q);
    openSearchTab(siteCode, q);
  }

  function jumpToMargin() {
    setTab('margin');
  }

  // ── 확장으로 보내기 — URL 딥링크 + Web Share API ──
  // 번개장터 등록 페이지로 가는 URL에 prefill 데이터를 인코딩.
  // PC에서 그 URL을 열면 content script가 sidepanel로 전달 → 폼 자동 채움.
  // 사진은 URL 한계로 못 보냄 — 백엔드 큐(Phase 8)로 별도 처리 예정.
  async function handleSendToExtension() {
    if (!tagInfo && !searchQuery && !cost && !price) {
      showToast('보낼 정보가 없습니다');
      return;
    }
    // 페이로드 — 확장 사이드패널의 Product 형태로 매핑
    const payload = {
      v: 1, // 스키마 버전
      title: tagInfo
        ? [tagInfo.brand, tagInfo.model].filter(Boolean).join(' ').trim()
        : (searchQuery || ''),
      brand: tagInfo?.brand,
      model: tagInfo?.model,
      modelCode: tagInfo?.modelCode,
      // 사이드패널 AI 입력란용 feature 필드에 합치기 (사이즈/색상 등 분류 안 된 텍스트)
      feature: [tagInfo?.size && `사이즈 ${tagInfo.size}`, tagInfo?.color]
        .filter(Boolean).join(', '),
      cost: cost || tagInfo?.price || 0,
      costCurrency: costCurrency || tagInfo?.currency || 'KRW',
      price: price || 0,
      priceCurrency: 'KRW',
      // 사진은 URL 한계로 못 담음 — Phase 8 백엔드 큐로 별도 처리
      photoCount: photos.length,
    };
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const url = `https://m.bunjang.co.kr/products/new?bjh_prefill=${b64}`;

    // 사진을 함께 공유 시도 — Web Share API의 files 지원 (iOS 15+, Android Chrome)
    // 지원되면 카톡/AirDrop으로 URL + 사진 한 번에 → PC가 둘 다 받음
    const photoFiles = photos.map((blob, i) => {
      const ext = (blob.type || 'image/jpeg').split('/')[1] || 'jpg';
      return new File([blob], `photo-${Date.now()}-${i + 1}.${ext}`, { type: blob.type || 'image/jpeg' });
    });

    if (navigator.share) {
      const baseShare = {
        title: '번장 등록 정보',
        text: photos.length > 0
          ? `PC에서 이 링크를 열면 폼이 자동 입력됩니다 (사진 ${photos.length}장 동봉)`
          : 'PC에서 이 링크를 열면 폼이 자동 입력됩니다',
        url,
      };
      // files 지원 여부 먼저 확인 — 미지원 환경에서 share 호출하면 throw
      const withFiles = photoFiles.length > 0
        && navigator.canShare
        && navigator.canShare({ files: photoFiles });
      try {
        await navigator.share(withFiles ? { ...baseShare, files: photoFiles } : baseShare);
        showToast(withFiles ? `공유 완료 (사진 ${photoFiles.length}장 포함)` : '공유 완료');
      } catch (e) {
        if (e?.name !== 'AbortError') {
          // 진짜 에러 — files 거부 등 → 텍스트만 재시도, 그것도 실패면 클립보드
          try {
            await navigator.share(baseShare);
            showToast('공유 완료 (사진은 따로 전송 필요)');
          } catch (e2) {
            if (e2?.name !== 'AbortError') await copyToClipboard(url);
          }
        }
      }
    } else {
      await copyToClipboard(url);
    }
  }
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('URL 복사됨 — PC에 붙여넣어 열기');
    } catch {
      showToast('복사 실패 — URL: ' + text.slice(0, 50) + '...');
    }
  }

  function handleSaveHistory() {
    if (!cost && !price) {
      showToast('원가/판매가를 입력하세요');
      return;
    }
    const entry = {
      id: String(Date.now()),
      title: scanned?.code ? `바코드 ${scanned.code}` : `즉시 입력 ${new Date().toLocaleString('ko-KR', {month:'numeric', day:'numeric'})}`,
      cost,
      costCurrency,
      price,
      profit: Math.round(margin.profit),
      pct: margin.pct,
      ts: Date.now(),
      barcode: scanned?.code,
    };
    setHistory(h => [entry, ...h].slice(0, 100));
    showToast('이력에 저장됨');
  }

  function downloadAllPhotos() {
    if (photos.length === 0) return;
    photos.forEach((blob, i) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `photo-${Date.now()}-${i+1}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    showToast(`${photos.length}장 다운로드`);
  }

  function clearHistory() {
    if (history.length === 0) return;
    if (!confirm('이력 전체를 삭제할까요?')) return;
    setHistory([]);
    showToast('이력 삭제됨');
  }

  // ─── 렌더 ───
  const photoUrls = useMemo(() => photos.map(b => URL.createObjectURL(b)), [photos]);
  // cleanup object URLs on unmount/photos change
  useEffect(() => () => photoUrls.forEach(u => URL.revokeObjectURL(u)), [photoUrls]);

  return (
    <div className={`m-root ${tweaks.dark?'dark':''}`} style={{'--accent': tweaks.accent}}>
      <style>{mobileCss}</style>

      <div className="m-topbar">
        <div style={{flex:1}}>
          <h1>스캐너</h1>
          <div className="m-topbar-sub">매장 현장 도구 · PWA</div>
        </div>
        <button className="m-topbar-icon" onClick={() => setTab('history')} title="이력"><MIcon.history/></button>
      </div>

      <div className="m-segbar">
        <button className={`m-seg ${tab==='scan'?'active':''}`} onClick={()=>setTab('scan')}>
          <MIcon.barcode s={14}/> 스캔
        </button>
        <button className={`m-seg ${tab==='margin'?'active':''}`} onClick={()=>setTab('margin')}>
          ₩ 마진
        </button>
        <button className={`m-seg ${tab==='history'?'active':''}`} onClick={()=>setTab('history')}>
          기록
        </button>
      </div>

      <div className="m-body">
        {tab==='scan' && (
          <>
            <div className="m-scan">
              <video ref={videoRef} className="m-scan-video" autoPlay muted playsInline />

              {cameraState === 'error' && (
                <div className="m-scan-perm">
                  <div>카메라 권한이 거부됐거나 사용할 수 없습니다.</div>
                  <div style={{fontSize:11.5, opacity:.7}}>{cameraError}</div>
                  <button onClick={() => { setTab('margin'); setTimeout(()=>setTab('scan'), 50); }}>다시 시도</button>
                </div>
              )}
              {cameraState === 'permission' && (
                <div className="m-scan-perm">카메라 권한 요청 중...</div>
              )}

              {/* 모서리 마커만 (스캔 라인 없음 — 더 이상 바코드 디코드 X) */}
              {cameraState === 'ready' && (
                <div className="m-scan-frame">
                  <div className="m-scan-window"><i/><b/></div>
                </div>
              )}

              <div className="m-scan-overlay">
                <div className="m-scan-top">
                  <div className="m-scan-pill">
                    <span className="live"/>
                    {cameraState === 'ready' ? '카메라 준비' : cameraState === 'permission' ? '권한 요청 중' : '대기'}
                  </div>
                  <div style={{display:'flex', gap:6}}>
                    <button className="m-scan-btn" onClick={handleSwitchCamera} title="카메라 전환"><MIcon.flip/></button>
                  </div>
                </div>
                <div className="m-scan-bottom" style={{gap:14, alignItems:'center'}}>
                  {/* 사진 추가 (왼쪽 보조) — 등록용 사진 캡처만, OCR 안 함 */}
                  <button
                    className="m-scan-btn"
                    onClick={handleCapturePhoto}
                    title="사진 추가 (등록용)"
                    style={{width:54, height:54}}>
                    <MIcon.camera s={20}/>
                  </button>

                  {/* 택 분석 (가운데, 메인) — OCR로 상품 정보 자동 채움 */}
                  <button
                    onClick={handleAnalyzeTag}
                    disabled={ocrLoading}
                    title="택 사진 분석 → 브랜드/모델/사이즈/가격 자동 추출"
                    style={{
                      width:74, height:74, borderRadius:'50%',
                      background: ocrLoading ? 'rgba(255,255,255,.4)' : 'var(--accent)',
                      border:'4px solid rgba(255,255,255,.35)',
                      color:'white', fontFamily:'inherit',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize: ocrLoading ? 24 : 12, fontWeight:700,
                      letterSpacing:'-.02em', lineHeight:1,
                      boxShadow: '0 4px 16px oklch(68% 0.15 45 / 0.4)',
                      opacity: ocrLoading ? 0.7 : 1,
                    }}>
                    {ocrLoading ? '⏳' : <span>택<br/>분석</span>}
                  </button>

                  {/* 자리맞춤용 빈 공간 */}
                  <div style={{width:54}}/>
                </div>
              </div>
            </div>

            {/* 택 분석 결과 + 검색 + 확장 전송 (하나의 카드에 통합) */}
            {(tagInfo || searchQuery) && (
              <div className="m-card" style={tagInfo ? {borderColor:'var(--accent)', borderWidth:1.5} : undefined}>
                {/* 택 분석 결과 */}
                {tagInfo && (
                  <>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                      <span className="m-chip accent" style={{fontSize:11}}>📷 택 분석 결과</span>
                      <button
                        onClick={() => { setTagInfo(null); setSearchQuery(''); }}
                        style={{marginLeft:'auto', border:'none', background:'transparent', color:'var(--ink-3)', fontSize:11, cursor:'pointer', padding:'2px 6px'}}>
                        지우기
                      </button>
                    </div>
                    {(tagInfo.brand || tagInfo.model) && (
                      <div style={{fontSize:16, fontWeight:600, marginBottom:8, letterSpacing:'-.02em'}}>
                        {[tagInfo.brand, tagInfo.model].filter(Boolean).join(' ')}
                      </div>
                    )}
                    <div style={{display:'flex', flexWrap:'wrap', gap:5, marginBottom:12}}>
                      {tagInfo.modelCode && <span className="m-chip">코드 {tagInfo.modelCode}</span>}
                      {tagInfo.size && <span className="m-chip">사이즈 {tagInfo.size}</span>}
                      {tagInfo.color && <span className="m-chip">{tagInfo.color}</span>}
                      {tagInfo.price && tagInfo.currency && (
                        <span className="m-chip success">
                          {tagInfo.currency === 'KRW' ? '₩' : tagInfo.currency === 'JPY' ? '¥' : '$'}
                          {tagInfo.price.toLocaleString()}
                        </span>
                      )}
                      {tagInfo.category && <span className="m-chip">{tagInfo.category}</span>}
                    </div>
                  </>
                )}

                {/* 검색어 input (편집 가능) */}
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:11, fontWeight:500, color:'var(--ink-2)', display:'block', marginBottom:4}}>
                    검색어 <span style={{color:'var(--ink-3)', fontWeight:400}}>(직접 편집 가능)</span>
                  </label>
                  <div className="m-num" style={{padding:'2px 12px'}}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="브랜드 + 모델명"
                      style={{
                        flex:1, border:'none', outline:'none', background:'transparent',
                        padding:'10px 0', fontSize:14, color:'var(--ink)',
                        minWidth:0,
                      }}
                    />
                  </div>
                  {lastSavedQuery && !searchQuery && (
                    <button
                      onClick={() => setSearchQuery(lastSavedQuery)}
                      style={{
                        marginTop:4, fontSize:10.5, color:'var(--accent)',
                        border:'none', background:'transparent', cursor:'pointer', padding:'2px 4px',
                      }}>
                      ↶ 마지막 검색어 "{lastSavedQuery.slice(0,20)}{lastSavedQuery.length>20?'…':''}" 사용
                    </button>
                  )}
                </div>

                {/* 멀티 사이트 검색 버튼 */}
                <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:6, marginBottom:10}}>
                  {SITE_PRESETS['sourcing-kr'].map(siteCode => {
                    const meta = SITES[siteCode];
                    return (
                      <button
                        key={siteCode}
                        className="m-btn"
                        onClick={() => handleSiteSearch(siteCode)}
                        title={meta.hint}
                        style={{padding:'12px 10px', fontSize:13, justifyContent:'flex-start', gap:6}}>
                        <span style={{fontSize:15}}>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>

                <details style={{marginBottom:10}}>
                  <summary style={{fontSize:11, color:'var(--ink-3)', cursor:'pointer', padding:'4px 0'}}>
                    더 많은 검색 (아마존JP / 요도바시 / 구글)
                  </summary>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6, marginTop:6}}>
                    {['amazonJp', 'yodobashi', 'google'].map(siteCode => {
                      const meta = SITES[siteCode];
                      return (
                        <button
                          key={siteCode}
                          className="m-btn"
                          onClick={() => handleSiteSearch(siteCode)}
                          title={meta.hint}
                          style={{padding:'10px 6px', fontSize:11, gap:4}}>
                          <span>{meta.emoji}</span>
                          <span>{meta.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </details>

                {/* 액션 버튼들 */}
                <div className="m-action-row" style={{marginBottom:0}}>
                  <button className="m-btn accent" onClick={handleSendToExtension}
                    title="확장(PC)으로 정보 전달 — 카톡으로 본인에게 보내거나 클립보드로 복사">
                    <MIcon.download s={14}/> PC로 보내기
                  </button>
                  <button className="m-btn primary" onClick={jumpToMargin}>
                    ₩ 마진
                  </button>
                </div>

                {/* OCR 원문 — 검수용 (저빈도) */}
                {tagInfo?.rawText && (
                  <details style={{marginTop:10}}>
                    <summary style={{fontSize:10.5, color:'var(--ink-3)', cursor:'pointer'}}>OCR 원문 텍스트</summary>
                    <pre style={{fontSize:10.5, color:'var(--ink-2)', whiteSpace:'pre-wrap', marginTop:6, fontFamily:'JetBrains Mono, monospace', maxHeight:120, overflow:'auto', padding:8, background:'var(--chip)', borderRadius:6}}>
                      {tagInfo.rawText}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* 등록용 사진 — 갤러리/폰 카메라에서 추가 (PWA 라이브 캡처보다 화질 ↑) */}
            <div className="m-section-title" style={{marginTop:photos.length || tagInfo || searchQuery ? 18 : 0}}>
              <span>등록용 사진 ({photos.length}/6)</span>
              {photos.length > 0 && (
                <button onClick={() => setPhotos([])}
                  style={{border:'none', background:'transparent', color:'var(--ink-3)', fontSize:11, cursor:'pointer'}}>
                  전체 삭제
                </button>
              )}
            </div>

            {/* 숨겨진 file input — 모바일에서 갤러리 + "사진 찍기" 옵션 자동 노출 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{display:'none'}}
              onChange={handleFileUpload}
            />

            {photos.length > 0 && (
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6, marginTop:8}}>
                {photoUrls.map((u, i) => (
                  <div key={i} style={{
                    aspectRatio:'1', borderRadius:10, position:'relative',
                    backgroundImage:`url(${u})`, backgroundSize:'cover', backgroundPosition:'center',
                  }}>
                    <div style={{
                      position:'absolute', top:4, left:5,
                      background:'rgba(0,0,0,.55)', color:'white', borderRadius:5,
                      padding:'1px 5px', fontSize:9.5, fontWeight:600,
                      fontFamily:'JetBrains Mono, monospace',
                    }}>{i+1}</div>
                    <button
                      onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      title="삭제"
                      style={{
                        position:'absolute', top:4, right:4,
                        width:20, height:20, borderRadius:'50%', border:'none',
                        background:'rgba(0,0,0,.6)', color:'white',
                        fontSize:12, lineHeight:1, cursor:'pointer',
                      }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="m-action-row" style={{marginTop:photos.length > 0 ? 10 : 4, marginBottom:0}}>
              {/* 메인 — 갤러리 + 폰 기본 카메라 (화질·UX 최상) */}
              <button
                className={`m-btn ${photos.length === 0 ? 'primary' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={photos.length >= 6}
                title="폰 갤러리 또는 기본 카메라로 사진 추가">
                📁 사진 추가
              </button>
              {/* 다운로드 (사진 있을 때만) */}
              {photos.length > 0 && (
                <button className="m-btn" onClick={downloadAllPhotos}>
                  <MIcon.download/> 받기
                </button>
              )}
            </div>

            <div style={{
              marginTop:8, padding:'8px 12px', background:'var(--chip)', borderRadius:8,
              fontSize:11, color:'var(--ink-3)', lineHeight:1.5,
            }}>
              💡 [PC로 보내기]를 누르면 카톡·에어드롭 등으로 사진과 URL을 함께 공유합니다 (지원 환경에서).
              미지원이면 다운로드 후 직접 옮기세요.
            </div>
          </>
        )}

        {tab==='margin' && (
          <>
            <div className="m-margin">
              <div className="m-margin-label">예상 수익</div>
              <div className={`m-margin-value m-margin-profit ${margin.profit>=0?'pos':'neg'}`}>
                {margin.profit >= 0 ? '+' : ''}{Math.round(margin.profit).toLocaleString()}
                <span className="m-margin-pct">원 · {margin.pct.toFixed(1)}%</span>
              </div>
              {/* 메루카리 노출가 참고 — 번개장터 메루카리 연동 시 일본 buyer가 보게 될 환산가 */}
              {price > 0 && (
                <div style={{
                  fontSize:11, color:'var(--ink-3)', marginTop:8,
                  paddingTop:8, borderTop:'1px dashed var(--line-2)',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                  <span>🇯🇵 메루카리 노출가 (참고)</span>
                  <span style={{fontFamily:'JetBrains Mono, monospace', fontWeight:600, color:'var(--ink-2)'}}>
                    ≈ ¥{Math.round(price / (settings.fxRateJpy || 9.3)).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="m-fx-status">
                <span title={fxMeta?.date ? `Frankfurter (ECB) · ${fxMeta.date} 기준` : '환율 미동기'}>
                  {fxMeta
                    ? `자동 갱신 · ¥${settings.fxRateJpy} / $${settings.fxRateUsd}`
                    : '환율 수동 입력'}
                </span>
                <button onClick={handleRefreshFx} disabled={fxLoading}>
                  <MIcon.refresh/> {fxLoading ? '…' : '새로고침'}
                </button>
              </div>
            </div>

            <div className="m-field">
              <label>원가 (구매가 · 마진용)</label>
              <div className="m-num">
                <input type="number" inputMode="decimal" min="0" placeholder="0"
                  value={cost === 0 ? '' : cost}
                  onChange={e => { const v = e.target.value; setCost(v === '' ? 0 : (Number(v)||0)); }}/>
                <select value={costCurrency} onChange={e => setCostCurrency(e.target.value)}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
                </select>
              </div>
            </div>
            <div className="m-field">
              <label>번개장터 판매가 (₩)</label>
              <div className="m-num">
                <input type="number" inputMode="numeric" min="0" placeholder="0"
                  value={price === 0 ? '' : price}
                  onChange={e => { const v = e.target.value; setPrice(v === '' ? 0 : (Number(v)||0)); }}/>
                <span className="unit" style={{fontSize:13, color:'var(--ink-3)', fontWeight:500}}>원</span>
              </div>
            </div>

            <div className="m-section-title"><span>산출 내역</span></div>
            <div className="m-card" style={{padding: '12px 14px'}}>
              {[
                [`원가 (환산 ${(CURRENCIES.find(c=>c.code===costCurrency)??CURRENCIES[0]).symbol})`, Math.round(margin.cost).toLocaleString() + '원'],
                ['배송비', settings.shipping.toLocaleString() + '원'],
                [`수수료 (${(settings.feeRate*100).toFixed(1)}%)`, Math.round(margin.fee).toLocaleString() + '원'],
              ].map(([k,v], i)=>(
                <div key={i} style={{
                  display:'flex', justifyContent:'space-between',
                  padding: '8px 0',
                  borderBottom: i<2 ? '1px solid var(--line)' : 'none',
                  fontSize: 13,
                }}>
                  <span style={{color:'var(--ink-2)'}}>{k}</span>
                  <span style={{fontFamily:'JetBrains Mono, monospace', fontWeight:500}}>{v}</span>
                </div>
              ))}
            </div>

            <button className="m-btn accent" onClick={handleSaveHistory} style={{marginTop:8}}>
              <MIcon.check/> 이력에 저장
            </button>

            <div className="m-section-title" style={{marginTop:18}}><span>설정</span></div>
            <div className="m-card" style={{padding:'12px 14px'}}>
              <div className="m-row" style={{marginBottom:10}}>
                <div className="m-field" style={{marginBottom:0}}>
                  <label>환율 ¥→₩</label>
                  <div className="m-num">
                    <input type="number" step="0.1" value={settings.fxRateJpy}
                      onChange={e => setSettings(s => ({...s, fxRateJpy: +e.target.value || 0}))}/>
                  </div>
                </div>
                <div className="m-field" style={{marginBottom:0}}>
                  <label>환율 $→₩</label>
                  <div className="m-num">
                    <input type="number" step="1" value={settings.fxRateUsd}
                      onChange={e => setSettings(s => ({...s, fxRateUsd: +e.target.value || 0}))}/>
                  </div>
                </div>
              </div>
              <div className="m-row">
                <div className="m-field" style={{marginBottom:0}}>
                  <label>배송비</label>
                  <div className="m-num">
                    <input type="number" value={settings.shipping}
                      onChange={e => setSettings(s => ({...s, shipping: +e.target.value || 0}))}/>
                  </div>
                </div>
                <div className="m-field" style={{marginBottom:0}}>
                  <label>수수료</label>
                  <div className="m-num">
                    <input type="number" step="0.01" value={settings.feeRate}
                      onChange={e => setSettings(s => ({...s, feeRate: +e.target.value || 0}))}/>
                  </div>
                </div>
              </div>
            </div>

            {/* Gemini API 키 — 택 OCR용 */}
            <div className="m-section-title" style={{marginTop:18}}>
              <span>Gemini API 키 (택 OCR)</span>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"
                style={{fontSize:10, color:'var(--accent)', textDecoration:'none', fontWeight:600}}>
                무료 발급 →
              </a>
            </div>
            <div className="m-card" style={{padding:'12px 14px'}}>
              <div className="m-field" style={{marginBottom:0}}>
                <label style={{fontSize:11, color:'var(--ink-3)'}}>
                  사진 OCR로 상품 정보 자동 추출 시 사용. 무료 1,500회/일.
                </label>
                <div className="m-num" style={{marginTop:6}}>
                  <input
                    type="password"
                    placeholder="AIza..."
                    value={settings.geminiApiKey || ''}
                    onChange={e => setSettings(s => ({...s, geminiApiKey: e.target.value}))}
                    style={{fontSize:13, fontFamily:'JetBrains Mono, monospace'}}
                  />
                </div>
                {settings.geminiApiKey && (
                  <div style={{fontSize:10, color:'var(--success)', marginTop:6}}>
                    ✓ 키 저장됨 ({settings.geminiApiKey.length}자) — 스캔 탭의 📷 버튼으로 택 분석 가능
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab==='history' && (
          <>
            <div className="m-section-title">
              <span>최근 {history.length}건</span>
              {history.length > 0 && (
                <button onClick={clearHistory}
                  style={{border:'none', background:'transparent', color:'var(--ink-3)', fontSize:11, cursor:'pointer'}}>
                  전체 삭제
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="m-empty">
                저장된 이력이 없습니다.<br/>
                마진 계산 후 "이력에 저장"을 눌러 보세요.
              </div>
            ) : (
              history.map((h) => {
                const sym = (CURRENCIES.find(c => c.code === (h.costCurrency || 'JPY')) ?? CURRENCIES[0]).symbol;
                const ago = (Date.now() - h.ts) / 1000;
                const agoText = ago < 60 ? '방금'
                  : ago < 3600 ? `${Math.floor(ago/60)}분 전`
                  : ago < 86400 ? `${Math.floor(ago/3600)}시간 전`
                  : `${Math.floor(ago/86400)}일 전`;
                return (
                  <div key={h.id} className="m-hist-row">
                    <div className="m-thumb" style={{width:44, height:44, fontSize:8}}>
                      {h.barcode ? h.barcode.slice(0, 4) : '—'}
                    </div>
                    <div className="m-hist-info">
                      <div className="m-hist-title">{h.title}</div>
                      <div className="m-hist-meta">{sym}{h.cost.toLocaleString()} → ₩{h.price.toLocaleString()} · {agoText}</div>
                    </div>
                    <div className="m-hist-profit"
                      style={{color: h.profit>=0 ? 'var(--success)' : 'var(--danger)'}}>
                      {h.profit>=0?'+':''}{(h.profit/1000).toFixed(1)}k
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {toast && <div className="m-toast"><MIcon.check/>{toast}</div>}
    </div>
  );
}

export default MobilePWA;
