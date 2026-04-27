// MobilePWA.jsx — 모바일 PWA: 카메라 바코드 스캔 → 메루카리 시세 → 마진 계산
// 디자인은 그대로 유지하면서 모든 기능을 실제로 동작하게 연결.
//
// 통신:
//   - 카메라: getUserMedia + ZXing (src/lib/scanner.ts)
//   - 환율:    Frankfurter API (src/lib/fx.ts)
//   - 메루카리: 검색 URL 생성 (src/lib/mercari.ts) → 새 탭 열기
//   - 저장:    localStorage (history, settings) — 확장 IndexedDB와는 분리

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BarcodeScanner } from '../lib/scanner';
import { fetchFxRatesIfStale, fetchFxRates } from '../lib/fx';
import { buildMercariSearchUrl, buildMercariBarcodeUrl, isValidJan } from '../lib/mercari';

// ─── localStorage key ──────────────────────────────────────────────
const LS_KEY_HISTORY  = 'bunjang-mobile:history';
const LS_KEY_SETTINGS = 'bunjang-mobile:settings';
const LS_KEY_FXMETA   = 'bunjang-mobile:fxMeta';

// ─── 기본 설정 ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  fxRateJpy: 9.3,
  fxRateUsd: 1380,
  shipping:  3500,
  feeRate:   0.06,
  costCurrency: 'KRW',  // 'JPY' | 'USD' | 'KRW' — 한국 매입이 기본 (필요 시 ¥/$로 변경)
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

  // 스캔 결과
  const [scanned, setScanned] = useState(null); // { code, format, ts } | null
  const [scanState, setScanState] = useState('idle'); // 'idle' | 'permission' | 'scanning' | 'error'
  const [scanError, setScanError] = useState(null);

  // 마진 입력
  const [cost, setCost] = useState(0);
  const [costCurrency, setCostCurrency] = useState(settings.costCurrency || 'JPY');
  const [price, setPrice] = useState(0);

  // 사진 (Blob[])
  const [photos, setPhotos] = useState([]);

  // 이력 (localStorage)
  const [history, setHistory] = useState(() => loadJson(LS_KEY_HISTORY, []));

  const [toast, setToast] = useState(null);
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  // 카메라/스캐너 ref
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

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

  // ─── 카메라/스캐너 라이프사이클 ───
  // 'scan' 탭일 때만 스캐너 실행, 다른 탭으로 가면 즉시 정지 (배터리/프라이버시)
  useEffect(() => {
    if (tab !== 'scan') {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current = null;
      }
      setScanState('idle');
      return;
    }
    let alive = true;
    (async () => {
      if (!videoRef.current) return;
      setScanState('permission');
      try {
        const scanner = new BarcodeScanner(videoRef.current);
        await scanner.start((result) => {
          if (!alive) return;
          setScanned({ code: result.text, format: result.format, ts: result.timestamp });
          showToast(`바코드 인식: ${result.text}`);
          // navigator.vibrate (지원 브라우저만)
          if (navigator.vibrate) navigator.vibrate(60);
        });
        scannerRef.current = scanner;
        if (alive) setScanState('scanning');
      } catch (e) {
        if (alive) {
          setScanError(e?.message || String(e));
          setScanState('error');
        }
      }
    })();
    return () => {
      alive = false;
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current = null;
      }
    };
  }, [tab]);

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

  async function handleCapturePhoto() {
    if (!scannerRef.current) {
      showToast('카메라가 활성화되지 않았습니다');
      return;
    }
    const blob = await scannerRef.current.capturePhoto();
    if (!blob) {
      showToast('캡처 실패');
      return;
    }
    setPhotos(prev => [...prev, blob].slice(-6));
    showToast(`사진 저장됨 · ${Math.min(photos.length + 1, 6)}/6`);
  }

  function handleSwitchCamera() {
    if (scannerRef.current) {
      scannerRef.current.switchCamera().then(() => {
        // switchCamera 자체가 스캐너를 stop하므로 useEffect가 재시작
        setScanState('idle');
        // 강제 재시작 트리거
        setTab(t => t);
      });
    }
  }

  function openMercariSearch() {
    if (!scanned) return;
    const url = isValidJan(scanned.code)
      ? buildMercariBarcodeUrl(scanned.code)
      : buildMercariSearchUrl(scanned.code);
    window.open(url, '_blank', 'noopener');
  }

  function jumpToMargin() {
    setTab('margin');
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

              {scanState === 'error' && (
                <div className="m-scan-perm">
                  <div>카메라 권한이 거부됐거나 사용할 수 없습니다.</div>
                  <div style={{fontSize:11.5, opacity:.7}}>{scanError}</div>
                  <button onClick={() => { setTab('margin'); setTimeout(()=>setTab('scan'), 50); }}>다시 시도</button>
                </div>
              )}
              {scanState === 'permission' && (
                <div className="m-scan-perm">카메라 권한 요청 중...</div>
              )}

              {scanState === 'scanning' && (
                <div className="m-scan-frame">
                  <div className="m-scan-window"><i/><b/></div>
                  {!scanned && <div className="m-scan-line"/>}
                </div>
              )}

              <div className="m-scan-overlay">
                <div className="m-scan-top">
                  <div className="m-scan-pill">
                    <span className="live"/>{scanned ? '검출됨' : (scanState === 'scanning' ? '탐색 중' : '대기')}
                  </div>
                  <div style={{display:'flex', gap:6}}>
                    <button className="m-scan-btn" onClick={handleSwitchCamera} title="카메라 전환"><MIcon.flip/></button>
                  </div>
                </div>
                <div className="m-scan-bottom">
                  <button className="m-scan-capture" onClick={handleCapturePhoto} title="사진 캡처"/>
                </div>
              </div>
            </div>

            {scanned && (
              <div className="m-card">
                <div className="m-card-head">
                  <div className="m-thumb">{scanned.format.slice(0,4)}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="m-card-title">{scanned.code}</div>
                    <div className="m-card-meta">{scanned.format} · {new Date(scanned.ts).toLocaleTimeString('ko-KR')}</div>
                    <div style={{marginTop:6, display:'flex', gap:4, flexWrap:'wrap'}}>
                      {isValidJan(scanned.code) && <span className="m-chip success"><MIcon.check s={10}/> JAN/EAN</span>}
                      <span className="m-chip">{scanned.format}</span>
                    </div>
                  </div>
                </div>
                <div className="m-action-row">
                  <button className="m-btn" onClick={openMercariSearch}>
                    <MIcon.merc/> 메루카리 시세
                  </button>
                  <button className="m-btn primary" onClick={jumpToMargin}>
                    ₩ 마진 계산
                  </button>
                </div>
                <button className="m-btn" style={{fontSize:12, padding:'10px 12px', background:'transparent', color:'var(--ink-3)'}}
                  onClick={() => setScanned(null)}>
                  스캔 결과 지우기
                </button>
              </div>
            )}

            {photos.length > 0 && (
              <>
                <div className="m-section-title">
                  <span>촬영 ({photos.length}/6)</span>
                  <button onClick={() => setPhotos([])}
                    style={{border:'none', background:'transparent', color:'var(--ink-3)', fontSize:11, cursor:'pointer'}}>
                    전체 삭제
                  </button>
                </div>
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
                    </div>
                  ))}
                </div>
                <button className="m-btn" style={{marginTop:10}} onClick={downloadAllPhotos}>
                  <MIcon.download/> 전체 다운로드
                </button>
              </>
            )}
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
