// sidepanel.jsx — Chrome Side Panel (VSCode-style, persistent, wider)
// 420~520px wide, full viewport height. No tabs — everything visible via sections.
// NOTE: Adapted from design bundle (Claude Design). Only the React import block
// and the bottom export were changed — UI markup/styles are verbatim.

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { generateProductInfo, generateTags } from '../lib/gemini';
import { saveImage, loadImageAsDataURL, deleteImage } from '../lib/images';
import { draft as draftStore, settings as settingsStore } from '../lib/storage';

const useStateSP = useState;
const useEffectSP = useEffect;
const useMemoSP = useMemo;
const useRefSP = useRef;

// Settings 기본값 (storage.ts의 DEFAULT_SETTINGS와 동일하게 유지)
const DEFAULT_AI_SETTINGS = {
  apiKey: '',
  model: 'flash',          // 'flash' | 'pro'
  fxRate: 9.3,
  shipping: 3500,
  feeRate: 0.03,
  dark: false,
  accent: '#151515',
  autoScan: true,
};

// 기본 AI 상품명 (Gemini 호출 전 placeholder)
const DEFAULT_AI_TITLES = [
  { key: 'seo',    label: '최대 검색 노출', text: '브랜드 + 모델 + 특징을 입력하고 생성 버튼을 눌러주세요' },
  { key: 'simple', label: '간결 직관',      text: '—' },
  { key: 'rare',   label: '한정 · 희소성',  text: '—' },
  { key: 'cond',   label: '상태 · 컨디션',  text: '—' },
  { key: 'jp',     label: '일본어 병기',    text: '—' },
];

const sidepanelCss = `
  .sp-root{
    --bg: #fbfaf7;
    --surface: #ffffff;
    --surface-2: #f6f4ef;
    --ink: #1d1a16;
    --ink-2: #5d574d;
    --ink-3: #9a938a;
    --line: rgba(29,26,22,.07);
    --line-2: rgba(29,26,22,.12);
    --chip: #f0ede7;
    --chip-hover: #e8e3d9;
    --accent: oklch(68% 0.15 45);
    --accent-soft: oklch(96% 0.03 60);
    --success: oklch(60% 0.14 150);
    --success-soft: oklch(96% 0.04 150);
    --danger: oklch(58% 0.18 25);
    --danger-soft: oklch(96% 0.04 25);
    font-family: 'Pretendard','Inter', -apple-system, system-ui, sans-serif;
    color: var(--ink);
    background: var(--bg);
    width: 100%; height: 100%;
    display:flex; flex-direction: column;
    overflow: hidden;
    font-size: 13px; line-height: 1.45;
    letter-spacing: -0.01em;
    font-feature-settings: 'cv11','ss01';
  }
  .sp-root.dark{
    --bg: #17161a;
    --surface: #1e1d21;
    --surface-2: #222125;
    --ink: #eceae5; --ink-2: #a6a39d; --ink-3: #6b6862;
    --line: rgba(255,255,255,.07); --line-2: rgba(255,255,255,.12);
    --chip: rgba(255,255,255,.06); --chip-hover: rgba(255,255,255,.1);
    --accent-soft: oklch(30% 0.06 45);
    --success-soft: oklch(24% 0.05 150);
    --danger-soft: oklch(26% 0.08 25);
  }
  .sp-root *{box-sizing:border-box}

  /* Top bar: logo + action buttons (always visible) */
  .sp-top{
    display:flex; align-items:center; gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
    flex-shrink: 0;
  }
  .sp-logo{
    width: 26px; height:26px; border-radius: 7px;
    background: linear-gradient(145deg, var(--accent), oklch(62% 0.17 30));
    color:white; font-weight:700; font-size:12px;
    display:flex; align-items:center; justify-content:center;
    box-shadow: 0 1px 0 rgba(255,255,255,.3) inset, 0 2px 6px oklch(68% 0.15 45 / 0.35);
  }
  .sp-title{ font-size: 13.5px; font-weight: 600; letter-spacing:-.015em; }
  .sp-sub{ font-size: 11px; color: var(--ink-3); }

  /* Sticky action bar below header */
  .sp-actionbar{
    display:flex; gap: 6px; padding: 10px 16px;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
    position: relative;
    z-index: 5;
  }
  .sp-btn{
    border:none; background: var(--chip); color: var(--ink);
    padding: 9px 12px; border-radius: 8px;
    font-family: inherit; font-size: 12.5px; font-weight: 500;
    cursor:pointer; display:inline-flex; align-items:center; gap:6px; justify-content:center;
    letter-spacing:-.01em;
    transition: background .12s, transform .06s;
  }
  .sp-btn:hover{ background: var(--chip-hover); }
  .sp-btn.accent{ background: var(--accent); color: white; flex: 2; }
  .sp-btn.ghost{ background: transparent; }
  .sp-btn.primary{ background: var(--ink); color: white; }
  .sp-btn.block{ width: 100%; padding: 10px 12px; }
  .sp-btn.sm{ padding: 6px 10px; font-size: 11.5px; }

  /* Icon button */
  .sp-icon-btn{
    width: 28px; height: 28px; border-radius: 7px;
    border: none; background: transparent; color: var(--ink-2);
    cursor: pointer; display:flex; align-items:center; justify-content:center;
  }
  .sp-icon-btn:hover{ background: var(--chip); color: var(--ink); }

  /* Body */
  .sp-body{
    flex:1; overflow-y: auto;
  }
  .sp-body::-webkit-scrollbar{ width: 10px; }
  .sp-body::-webkit-scrollbar-thumb{ background: var(--line-2); border-radius:8px; }
  .sp-body::-webkit-scrollbar-track{ background: transparent; }

  /* Section — collapsible */
  .sp-section{
    border-bottom: 1px solid var(--line);
  }
  .sp-section-head{
    display:flex; align-items:center; gap: 10px;
    padding: 11px 16px 11px;
    cursor: pointer;
    user-select: none;
  }
  .sp-section-head:hover{ background: var(--surface-2); }
  .sp-section-caret{
    width: 14px; height: 14px; color: var(--ink-3);
    transition: transform .14s;
  }
  .sp-section.open .sp-section-caret{ transform: rotate(90deg); }
  .sp-section-title{
    font-size: 11px; font-weight: 700; color: var(--ink-2);
    text-transform: uppercase; letter-spacing: 0.08em;
    flex: 1;
  }
  .sp-section-meta{
    font-size: 11px; color: var(--ink-3); font-weight: 500;
  }
  .sp-section-body{
    padding: 0 16px 16px;
  }
  .sp-section.collapsed .sp-section-body{ display: none; }

  /* Grid-layout utilities */
  .sp-row{ display:flex; gap: 8px; }
  .sp-row > *{ flex:1; min-width: 0; }

  /* Form bits */
  .sp-field{ display:flex; flex-direction:column; gap: 5px; margin-bottom: 10px; }
  .sp-label{ font-size: 11.5px; font-weight:500; color: var(--ink-2); display:flex; gap:4px; align-items:center; }
  .sp-label .req{ color: var(--accent); }
  .sp-input, .sp-textarea, .sp-select{
    width:100%; border:1px solid var(--line-2); background: var(--surface);
    border-radius: 8px; padding: 9px 11px; font-size: 13px;
    color: var(--ink); font-family:inherit;
    transition: border .12s, box-shadow .12s;
    letter-spacing:-.01em;
  }
  .sp-textarea{ resize: vertical; min-height: 72px; line-height: 1.5; }
  .sp-input:focus, .sp-textarea:focus, .sp-select:focus{
    outline:none; border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .sp-input::placeholder, .sp-textarea::placeholder{ color: var(--ink-3); }

  .sp-num{
    display:flex; align-items:center; gap:6px;
    border:1px solid var(--line-2); background: var(--surface);
    border-radius: 8px; padding: 2px 10px 2px 11px;
    transition: border .12s, box-shadow .12s;
  }
  .sp-num:focus-within{ border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent); }
  .sp-num input{
    flex:1; border:none; outline:none; background:transparent;
    padding: 9px 0; font-size:13px; color: var(--ink);
    font-family:'JetBrains Mono','SF Mono',monospace;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }
  .sp-num .unit{ font-size: 11px; color: var(--ink-3); font-weight:500; }

  /* Image slots */
  .sp-imgs{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .sp-imgslot{
    aspect-ratio: 1/1; background: var(--surface);
    border: 1.5px dashed var(--line-2); border-radius: 9px;
    display:flex; align-items:center; justify-content:center;
    color: var(--ink-3); cursor: pointer;
    position: relative; overflow: hidden;
    font-size: 10px;
    transition: border-color .12s, background .12s;
  }
  .sp-imgslot:hover{ border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
  .sp-imgslot.filled{ border-style:solid; border-color: transparent; }
  .sp-imgslot .fill{ position:absolute; inset:0; background-size:cover; background-position:center; }
  .sp-imgslot .rm{
    position:absolute; top:4px; right:4px; width:20px; height:20px;
    border-radius:5px; background: rgba(0,0,0,.6); color:white;
    border:none; cursor:pointer; font-size:13px; line-height:1;
    display:flex; align-items:center; justify-content:center;
    opacity:0; transition: opacity .12s;
  }
  .sp-imgslot:hover .rm{ opacity:1; }
  .sp-imgslot .idx{
    position:absolute; top:5px; left:6px;
    background: rgba(0,0,0,.55); color: white;
    border-radius: 4px; padding: 1px 5px; font-size: 9.5px; font-weight:600;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Margin */
  .sp-margin{
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 12px; padding: 12px 14px;
    display:flex; flex-direction: column; gap: 6px;
  }
  .sp-margin-row{
    display:flex; align-items:center; justify-content:space-between;
    font-size: 12px; color: var(--ink-2);
  }
  .sp-margin-row .v{ font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; color: var(--ink); }
  .sp-margin-total{
    display: flex; align-items: baseline; justify-content: space-between;
    padding-top: 10px; margin-top: 4px; border-top: 1px dashed var(--line-2);
  }
  .sp-margin-total .v{
    font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums;
    font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
  }
  .profit-pos{ color: var(--success); }
  .profit-neg{ color: var(--danger); }
  .sp-margin-total .pct{ font-size: 11px; color: var(--ink-3); margin-left: 6px; font-family:'JetBrains Mono',monospace; }

  /* AI Cards */
  .sp-ai-grid{ display: flex; flex-direction: column; gap: 6px; }
  .sp-ai{
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 10px; padding: 10px 12px;
    cursor: pointer; position: relative;
    transition: border .12s, box-shadow .12s;
  }
  .sp-ai:hover{ border-color: var(--line-2); }
  .sp-ai.selected{ border-color: var(--ink); box-shadow: 0 0 0 3px oklch(20% 0 0 / 0.06); }
  .sp-ai-style{ font-size: 10px; font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; display:flex; align-items:center; gap:5px; margin-bottom: 4px; }
  .sp-ai-style .dot{ width:5px; height:5px; border-radius:99px; background: var(--accent); }
  .sp-ai-title{ font-size: 12.5px; line-height: 1.4; letter-spacing:-.01em; font-weight: 500; padding-right: 40px; word-break: keep-all; overflow-wrap: break-word; }
  .sp-ai-len{ position:absolute; top:10px; right:12px; font-size: 10px; color: var(--ink-3); font-family:'JetBrains Mono', monospace; background: var(--surface); padding: 0 3px; }

  /* Templates */
  .sp-tpl-row{
    display:flex; align-items:center; gap:10px;
    padding: 8px 10px; border-radius: 7px;
    cursor:pointer; border: 1px solid transparent;
  }
  .sp-tpl-row:hover{ background: var(--surface); border-color: var(--line); }
  .sp-tpl-row.active{ background: var(--surface); border-color: var(--line-2); }
  .sp-tpl-sc{
    width: 20px; height: 20px; border-radius: 5px;
    background: var(--chip); color: var(--ink-2);
    display:flex; align-items:center; justify-content:center;
    font-size: 10.5px; font-weight:600; font-family:'JetBrains Mono',monospace;
    flex-shrink: 0;
  }
  .sp-tpl-row.active .sp-tpl-sc{ background: var(--ink); color: white; }
  .sp-tpl-name{ font-size: 12.5px; font-weight: 500; }
  .sp-tpl-prev{ font-size: 10.5px; color: var(--ink-3); margin-top:1px; }

  /* Diag */
  .sp-diag{ border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
  .sp-diag-row{
    display:flex; align-items:center; gap:10px;
    padding: 8px 12px; font-size: 12px;
    border-bottom: 1px solid var(--line);
  }
  .sp-diag-row:last-child{ border-bottom: none; }
  .sp-diag-st{
    width: 16px; height: 16px; border-radius: 99px;
    display:flex; align-items:center; justify-content:center;
    font-size: 9px; flex-shrink:0;
  }
  .sp-diag-st.ok{ background: var(--success-soft); color: var(--success); }
  .sp-diag-st.fail{ background: var(--danger-soft); color: var(--danger); }
  .sp-diag-label{ flex:1; color: var(--ink-2); }
  .sp-diag-val{ font-family:'JetBrains Mono',monospace; font-size: 10.5px; color: var(--ink-3); }

  /* Chip */
  .sp-chip{
    display:inline-flex; align-items:center; gap:4px;
    background: var(--chip); color: var(--ink-2);
    padding: 2px 7px; border-radius: 99px;
    font-size: 10.5px; font-weight: 500;
  }
  .sp-chip.success{ background: var(--success-soft); color: var(--success); }
  .sp-chip.danger{ background: var(--danger-soft); color: var(--danger); }
  .sp-chip.accent{ background: var(--accent-soft); color: var(--accent); }

  .sp-hint{ font-size: 10.5px; color: var(--ink-3); }
  .kbd{
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    padding: 1px 5px; border-radius: 4px;
    background: var(--chip); color: var(--ink-2);
    border: 1px solid var(--line);
  }

  /* Status strip (live "page detected") */
  .sp-status-strip{
    display:flex; align-items:center; gap: 8px;
    padding: 6px 16px;
    font-size: 11px;
    background: var(--surface-2);
    color: var(--ink-2);
    border-bottom: 1px solid var(--line);
    font-family: 'JetBrains Mono', monospace;
  }
  .sp-live-dot{
    width:6px; height:6px; border-radius: 999px;
    background: var(--success);
    box-shadow: 0 0 0 3px var(--success-soft);
  }

  /* Toast */
  @keyframes sp-toast-in{
    from{ opacity: 0; transform: translate(-50%, 8px); }
    to{ opacity: 1; transform: translate(-50%, 0); }
  }
  .sp-toast{
    position: absolute; left: 50%; bottom: 24px;
    transform: translateX(-50%);
    background: var(--ink); color: white;
    padding: 8px 14px; border-radius: 8px;
    font-size: 12px; font-weight: 500;
    animation: sp-toast-in .18s ease-out;
    display: flex; align-items:center; gap:8px;
    box-shadow: 0 4px 18px rgba(0,0,0,.2);
    z-index: 50;
  }

  /* ═══════════════════════════════════════════
     ✦ Luster · Gloss · Trendy Animations
  ═══════════════════════════════════════════ */

  /* Gloss sweep — used on logo & action button */
  @keyframes sp-gloss-sweep {
    0%   { transform: translateX(-130%) skewX(-18deg); }
    100% { transform: translateX(130%) skewX(-18deg); }
  }

  /* Section fade-in when expanded */
  @keyframes sp-fade-up {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Live dot pulse */
  @keyframes sp-live-pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 30%, transparent); }
    60%       { box-shadow: 0 0 0 5px color-mix(in srgb, var(--success) 0%, transparent); }
  }

  /* Logo — black metallic + continuous gloss sweep */
  .sp-logo {
    background: linear-gradient(150deg, #2c2c2c 0%, #0c0c0c 55%, #222 100%) !important;
    box-shadow:
      0 1px 0 rgba(255,255,255,.16) inset,
      0 -1px 0 rgba(0,0,0,.35) inset,
      0 3px 12px rgba(0,0,0,.45) !important;
    position: relative;
    overflow: hidden;
    transition: box-shadow .2s, transform .18s cubic-bezier(.34,1.56,.64,1) !important;
  }
  .sp-logo::after {
    content: '';
    position: absolute;
    top: -20%; left: -65%;
    width: 50%; height: 140%;
    background: linear-gradient(110deg, transparent, rgba(255,255,255,.24), transparent);
    animation: sp-gloss-sweep 3.8s ease-in-out infinite;
    pointer-events: none;
  }
  .sp-logo:hover {
    transform: scale(1.08) !important;
    box-shadow:
      0 1px 0 rgba(255,255,255,.18) inset,
      0 -1px 0 rgba(0,0,0,.35) inset,
      0 6px 18px rgba(0,0,0,.55) !important;
  }

  /* Action button — shimmer on hover + spring lift */
  .sp-btn.accent {
    background: #111 !important;
    overflow: hidden;
    box-shadow: 0 1px 0 rgba(255,255,255,.07) inset, 0 2px 8px rgba(0,0,0,.28);
    transition: background .12s, transform .18s cubic-bezier(.34,1.4,.64,1), box-shadow .18s !important;
  }
  .sp-btn.accent::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,.11) 50%, transparent 80%);
    transform: translateX(-120%);
    transition: transform .55s ease;
    pointer-events: none;
  }
  .sp-btn.accent:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 1px 0 rgba(255,255,255,.07) inset, 0 8px 22px rgba(0,0,0,.35) !important;
  }
  .sp-btn.accent:hover::before { transform: translateX(120%); }
  .sp-btn.accent:active {
    transform: translateY(0) scale(.97) !important;
    box-shadow: 0 1px 4px rgba(0,0,0,.2) !important;
  }

  /* Regular buttons — subtle spring lift */
  .sp-btn {
    transition: background .12s, transform .16s cubic-bezier(.34,1.4,.64,1), box-shadow .14s !important;
  }
  .sp-btn:not(.accent):hover { transform: translateY(-1px) !important; }
  .sp-btn:not(.accent):active { transform: translateY(0) scale(.97) !important; }

  /* AI cards — lift + shadow on hover */
  .sp-ai {
    transition: border .12s, box-shadow .16s, transform .18s cubic-bezier(.34,1.3,.64,1) !important;
  }
  .sp-ai:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 24px rgba(0,0,0,.09) !important;
  }

  /* Template rows — slide right on hover */
  .sp-tpl-row {
    transition: background .12s, border-color .12s, transform .15s cubic-bezier(.34,1.3,.64,1) !important;
  }
  .sp-tpl-row:hover { transform: translateX(3px) !important; }

  /* Icon buttons — spring rotation */
  .sp-icon-btn {
    transition: background .12s, color .12s, transform .22s cubic-bezier(.34,1.56,.64,1) !important;
  }
  .sp-icon-btn:hover { transform: rotate(12deg) scale(1.12) !important; }

  /* Section body — fade in when expanded */
  .sp-section.open .sp-section-body {
    animation: sp-fade-up .2s ease-out;
  }

  /* Live dot — pulsing glow */
  .sp-live-dot {
    animation: sp-live-pulse 2.4s ease-in-out infinite !important;
  }
`;

// Reuse Icon from popup.jsx (it's on window via script order)
const SPI = {
  caret: () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 3L8 6L4 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  sparkle: () => (<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L9.3 6.2L14 7.5L9.3 8.8L8 13.5L6.7 8.8L2 7.5L6.7 6.2L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>),
  check: () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  x: () => (<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  plus: () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  copy: () => (<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M3 11.5V3.5C3 2.67 3.67 2 4.5 2H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  cart: () => (<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 2H3.5L5 10H13L14.5 4H4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="13" r="1" fill="currentColor"/><circle cx="12" cy="13" r="1" fill="currentColor"/></svg>),
  carrot: () => (<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11 3.5L9.5 2L2.5 9L4 13.5L8 12L13.5 6.5L11 3.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>),
  settings: () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  history: () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 1 0 1.8-4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M2 2v3h3M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  spin: () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/><path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
};

function stripedSP(seed){
  const pals = [['#e8dfd3','#d8cab7'],['#dfd5c4','#c9bba3'],['#d3c5ad','#b8a689']];
  const [a,b] = pals[seed % pals.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><defs><pattern id='p' width='10' height='10' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='10' height='10' fill='${a}'/><rect width='5' height='10' fill='${b}'/></pattern></defs><rect width='120' height='120' fill='url(#p)'/></svg>`;
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg);
}

function SPSection({ id, title, meta, defaultOpen = true, children }){
  const [open, setOpen] = useStateSP(defaultOpen);
  return (
    <div className={`sp-section ${open?'open':'collapsed'}`}>
      <div className="sp-section-head" onClick={()=>setOpen(!open)}>
        <div className="sp-section-caret">{SPI.caret()}</div>
        <div className="sp-section-title">{title}</div>
        {meta && <div className="sp-section-meta">{meta}</div>}
      </div>
      <div className="sp-section-body">{children}</div>
    </div>
  );
}

function SidePanel({ tweaks }){
  const [product, setProduct] = useStateSP({
    title: '',
    cost: 0,
    price: 0,
    desc: '',
    imgs: [],            // IndexedDB 키 배열 (예: ['img:1714...-abc'])
    tags: [],
    categoryPath: [],    // [대분류, 중분류, 소분류]
  });
  // Settings (chrome.storage.local 영구 저장)
  const [appSettings, setAppSettings] = useStateSP(DEFAULT_AI_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useStateSP(false);
  const [settingsLoaded, setSettingsLoaded] = useStateSP(false);

  const [toast, setToast] = useStateSP(null);
  const [aiTitles, setAiTitles] = useStateSP(DEFAULT_AI_TITLES);
  const [aiSelected, setAiSelected] = useStateSP(null);
  const [aiLoading, setAiLoading] = useStateSP(false);
  const [aiDesc, setAiDesc] = useStateSP(null);   // AI 생성 설명 초안 (null = 미생성)
  const [tagLoading, setTagLoading] = useStateSP(false);
  const [tplActive, setTplActive] = useStateSP(0);
  // 브랜드/모델/특징 — AI 섹션 + 태그 생성 공용
  const [aiInputs, setAiInputs] = useStateSP({ brand: '', model: '', feature: '' });

  // 이미지 미리보기 (key → dataURL) 캐시 — IndexedDB에서 비동기 로드
  const [imgPreviews, setImgPreviews] = useStateSP({});
  const [dragOverIdx, setDragOverIdx] = useStateSP(null);
  const fileInputRef = useRefSP(null);

  // ── Phase 1: 실제 메시지 연결 ──
  const [injecting, setInjecting] = useStateSP(false);
  const [diagResults, setDiagResults] = useStateSP(null); // null = 미실행
  const [currentUrl, setCurrentUrl] = useStateSP('');
  const [isBunjang, setIsBunjang] = useStateSP(false);

  // 마진 계산용 — settings에서 동기화
  const fx = appSettings.fxRate;
  const shipping = appSettings.shipping;
  const feeRate = appSettings.feeRate;

  // 현재 탭 URL 초기화 + tab:url 메시지 수신
  useEffectSP(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.url) {
        setCurrentUrl(tab.url);
        setIsBunjang(tab.url.includes('bunjang.co.kr'));
      }
    });
    const onMessage = (msg) => {
      if (msg?.type === 'tab:url') {
        setCurrentUrl(msg.url);
        setIsBunjang(msg.isBunjang);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  // ── 초안 + 설정 로드 (mount 1회) ──
  useEffectSP(() => {
    let alive = true;
    (async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const [savedDraft, savedSettings] = await Promise.all([
            draftStore.get(),
            settingsStore.get(),
          ]);
          if (!alive) return;
          if (savedDraft) {
            setProduct(p => ({
              ...p,
              ...savedDraft,
              imgs: Array.isArray(savedDraft.imgs) ? savedDraft.imgs : [],
              tags: Array.isArray(savedDraft.tags) ? savedDraft.tags : [],
            }));
          }
          if (savedSettings) {
            setAppSettings(s => ({ ...s, ...savedSettings }));
          }
        }
      } catch (e) {
        console.warn('[sidepanel] storage 로드 실패:', e);
      } finally {
        if (alive) setSettingsLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── 초안 자동 저장 (debounced 500ms) ──
  useEffectSP(() => {
    if (!settingsLoaded) return; // 초기 로드 전 덮어쓰기 방지
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const t = setTimeout(() => {
      draftStore.set(product).catch(e => console.warn('[sidepanel] draft 저장 실패:', e));
    }, 500);
    return () => clearTimeout(t);
  }, [product, settingsLoaded]);

  // ── 설정 변경 시 즉시 저장 ──
  useEffectSP(() => {
    if (!settingsLoaded) return;
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    settingsStore.set(appSettings).catch(e => console.warn('[sidepanel] settings 저장 실패:', e));
  }, [appSettings, settingsLoaded]);

  // ── 이미지 미리보기 로드 (product.imgs 변경 시 신규 키만 로드) ──
  useEffectSP(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    let alive = true;
    const keysToLoad = (product.imgs || [])
      .filter(k => typeof k === 'string' && k.startsWith('img:') && !imgPreviews[k]);
    if (keysToLoad.length === 0) return;
    (async () => {
      const updates = {};
      for (const key of keysToLoad) {
        try {
          const url = await loadImageAsDataURL(key);
          if (url) updates[key] = url;
        } catch (e) {
          console.warn('[sidepanel] 이미지 로드 실패:', key, e);
        }
      }
      if (alive && Object.keys(updates).length > 0) {
        setImgPreviews(prev => ({ ...prev, ...updates }));
      }
    })();
    return () => { alive = false; };
  }, [product.imgs]);

  const margin = useMemoSP(()=>{
    const c = product.cost * fx;
    const fee = product.price * feeRate;
    const profit = product.price - c - shipping - fee;
    const pct = product.price > 0 ? profit/product.price * 100 : 0;
    return { cost: c, fee, profit, pct };
  }, [product, fx, shipping, feeRate]);

  function showToast(msg){
    setToast(msg);
    setTimeout(()=>setToast(null), 1600);
  }

  // 태그 자동생성 — Gemini API 실 호출
  async function handleGenerateTags() {
    if (tagLoading) return;
    if (!appSettings.apiKey) {
      showToast('설정에서 Gemini API 키를 입력하세요');
      setSettingsOpen(true);
      return;
    }
    if (!aiInputs.brand && !aiInputs.model) {
      showToast('브랜드 또는 모델명을 입력해주세요');
      return;
    }
    setTagLoading(true);
    try {
      const tags = await generateTags(
        {
          brand: aiInputs.brand,
          model: aiInputs.model,
          feature: aiInputs.feature,
        },
        appSettings.apiKey,
        appSettings.model,
      );
      setProduct(p => ({...p, tags}));
      showToast(`태그 ${tags.length}개 생성됨`);
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg === 'GEMINI_NO_KEY') {
        showToast('API 키가 비어있습니다');
        setSettingsOpen(true);
      } else {
        showToast('태그 생성 실패: ' + msg);
      }
    } finally {
      setTagLoading(false);
    }
  }

  // ── AI 상품명 + 설명 생성 — Gemini API 실 호출 ──
  async function handleGenerateAI() {
    if (aiLoading) return;
    if (!appSettings.apiKey) {
      showToast('설정에서 Gemini API 키를 입력하세요');
      setSettingsOpen(true);
      return;
    }
    if (!aiInputs.brand || !aiInputs.model) {
      showToast('브랜드와 모델명을 모두 입력해주세요');
      return;
    }
    setAiLoading(true);
    setAiSelected(null);
    setAiDesc(null);
    try {
      const out = await generateProductInfo(
        {
          brand: aiInputs.brand,
          model: aiInputs.model,
          feature: aiInputs.feature,
          condition: product.condition,
          cost: product.cost,
          price: product.price,
        },
        appSettings.apiKey,
        appSettings.model,
      );
      // titles 배열을 UI 포맷으로 변환
      const mapped = out.titles.map((t, i) => ({
        key: `ai-${i}`,
        label: t.style,
        text: t.title,
      }));
      setAiTitles(mapped);
      setAiDesc(out.description);
      setAiSelected(0);

      // 모든 항목 자동 채움 — 첫 번째 상품명, 설명, 태그, 카테고리
      setProduct(p => ({
        ...p,
        title: out.titles[0]?.title || p.title,
        desc:  out.description       || p.desc,
        tags:  Array.isArray(out.tags) && out.tags.length > 0 ? out.tags : p.tags,
        categoryPath: Array.isArray(out.categoryPath) && out.categoryPath.length > 0
          ? out.categoryPath
          : p.categoryPath,
      }));
      showToast('AI로 모든 항목이 채워졌어요');
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg === 'GEMINI_NO_KEY') {
        showToast('API 키가 비어있습니다');
        setSettingsOpen(true);
      } else if (msg === 'GEMINI_PARSE_ERROR') {
        showToast('AI 응답 파싱 실패 — 다시 시도해주세요');
      } else {
        showToast('AI 생성 실패: ' + msg);
      }
    } finally {
      setAiLoading(false);
    }
  }

  // ── 이미지 추가 (파일 선택 또는 드래그&드롭) ──
  const handleAddImages = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    const remaining = Math.max(0, 3 - (product.imgs?.length || 0));
    if (remaining === 0) {
      showToast('이미지는 최대 3개까지 가능합니다');
      return;
    }
    const accepted = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, remaining);
    if (accepted.length === 0) {
      showToast('이미지 파일만 추가 가능합니다');
      return;
    }
    try {
      const keys = await Promise.all(accepted.map(f => saveImage(f)));
      setProduct(p => ({...p, imgs: [...(p.imgs || []), ...keys]}));
      showToast(`이미지 ${keys.length}개 추가됨`);
    } catch (e) {
      showToast('이미지 저장 실패: ' + (e?.message || String(e)));
    }
  }, [product.imgs]);

  const handleRemoveImage = useCallback(async (idx) => {
    const key = product.imgs[idx];
    setProduct(p => ({...p, imgs: p.imgs.filter((_, i) => i !== idx)}));
    if (key && typeof key === 'string' && key.startsWith('img:')) {
      try { await deleteImage(key); } catch (e) { console.warn('[sidepanel] deleteImage 실패:', e); }
      setImgPreviews(prev => {
        const next = {...prev};
        delete next[key];
        return next;
      });
    }
  }, [product.imgs]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleInject() {
    if (injecting) return;
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      showToast('Chrome 확장 컨텍스트에서만 사용 가능');
      return;
    }
    setInjecting(true);
    setDiagResults(null);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'inject', product });
      if (response?.results) {
        setDiagResults(response.results);
        const ok = response.results.filter(r => r.ok).length;
        const total = response.results.length;
        showToast(`자동입력 완료 ${ok}/${total} 성공`);
      } else {
        showToast('응답 없음 — content script 확인 필요');
      }
    } catch (e) {
      showToast('오류: ' + (e?.message || String(e)));
    } finally {
      setInjecting(false);
    }
  }

  const TPL = [
    { name: '배송 안내', text: '📦 구매 확정 후 1~2일 내 출고됩니다.\nCJ대한통운 기준, 제주/도서산간 추가 3,000원.' },
    { name: '정품 보증', text: '✅ 100% 정품 보증. 일본 공식 스토어 매입건.' },
    { name: '문의 안내', text: '💬 채팅 문의 환영. 실측/컨디션 사진 요청 가능.' },
    { name: '상품 상태', text: '🏷️ S급 (미사용에 가까움) / 박스·택 포함.' },
    { name: '반품 정책', text: '↩️ 단순 변심 반품 가능 (7일 이내, 왕복비 구매자).' },
    { name: '네고 정책', text: '💸 과도한 할인 요청은 답변드리지 않을 수 있습니다.' },
  ];

  return (
    <div className={`sp-root ${tweaks.dark?'dark':''}`} style={{'--accent': tweaks.accent}}>
      <style>{sidepanelCss}</style>

      {/* Header */}
      <div className="sp-top">
        <div className="sp-logo" title="번개장터 홈으로" style={{cursor:'pointer'}}
          onClick={() => {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
              chrome.tabs.create({ url: 'https://m.bunjang.co.kr/' });
            } else {
              window.open('https://m.bunjang.co.kr/', '_blank');
            }
          }}>
          {/* 번개 아이콘 */}
          <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M8.5 1L2 9H7.5L5 14L11 6H5.5L8.5 1Z"
              fill="white"
              fillOpacity="0.95"
              style={{filter:'drop-shadow(0 0 2px rgba(255,255,255,0.4))'}}
            />
          </svg>
        </div>
        <div style={{lineHeight: 1.2, flex: 1}}>
          <div className="sp-title">번개장터 등록 도우미</div>
          <div className="sp-sub">번개장터</div>
        </div>
        <button className="sp-icon-btn" title="기록">{SPI.history()}</button>
        <button className="sp-icon-btn" title="설정" onClick={() => setSettingsOpen(true)}>{SPI.settings()}</button>
      </div>

      {/* Status strip — shows connected page */}
      <div className="sp-status-strip">
        <div className="sp-live-dot" style={!isBunjang ? {background:'var(--ink-3)', boxShadow:'none', animation:'none'} : {}}/>
        <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1}}>
          {currentUrl ? (() => { try { const u = new URL(currentUrl); return u.hostname + u.pathname; } catch { return currentUrl; } })() : '탭 감지 중…'}
        </span>
        <span style={{marginLeft:8, flexShrink:0, color: isBunjang ? 'var(--success)' : 'var(--ink-3)'}}>
          {isBunjang ? '● 연결됨' : '○ 미연결'}
        </span>
      </div>

      {/* Persistent action bar (always visible) */}
      <div className="sp-actionbar">
        <button className="sp-btn accent" style={{flex:1, opacity: injecting ? 0.7 : 1}} onClick={handleInject} disabled={injecting}>
          {injecting ? <>{SPI.spin()} 주입 중…</> : <>{SPI.cart()} 번개장터 자동입력</>}
        </button>
      </div>

      <div className="sp-body">
        {/* AI 상품정보 생성 — 한 번 누르면 모든 항목 채움 */}
        <SPSection title="AI 상품정보 생성" meta={
          <span className="sp-chip accent">
            {SPI.sparkle()} Gemini {appSettings.model === 'pro' ? 'Pro' : 'Flash'}
          </span>
        }>
          <div className="sp-row" style={{marginBottom:8, flexWrap:'wrap'}}>
            <div className="sp-field" style={{marginBottom:0, minWidth: 100}}>
              <label className="sp-label">브랜드 <span className="req">*</span></label>
              <input className="sp-input" value={aiInputs.brand} placeholder="예: 아디다스"
                onChange={e => setAiInputs(v => ({...v, brand: e.target.value}))}/>
            </div>
            <div className="sp-field" style={{marginBottom:0, minWidth: 100}}>
              <label className="sp-label">모델 <span className="req">*</span></label>
              <input className="sp-input" value={aiInputs.model} placeholder="예: 삼바 OG"
                onChange={e => setAiInputs(v => ({...v, model: e.target.value}))}/>
            </div>
            <div className="sp-field" style={{marginBottom:0, minWidth: 100}}>
              <label className="sp-label">특징</label>
              <input className="sp-input" value={aiInputs.feature} placeholder="예: S급, 정품"
                onChange={e => setAiInputs(v => ({...v, feature: e.target.value}))}/>
            </div>
          </div>
          <button className="sp-btn primary block" style={{marginBottom: 10}}
            onClick={handleGenerateAI} disabled={aiLoading}>
            {aiLoading
              ? <>{SPI.spin()} 생성 중…</>
              : <>{SPI.sparkle()} AI로 모든 항목 채우기</>}
          </button>
          {/* 생성 후: 다른 스타일 상품명 카드 — 클릭 시 즉시 교체 */}
          {aiTitles[0]?.key.startsWith('ai-') && (
            <>
              <div className="sp-hint" style={{marginBottom:6}}>
                상품명 다른 스타일로 바꾸려면 카드 클릭
              </div>
              <div className="sp-ai-grid">
                {aiTitles.map((r,i)=>(
                  <div key={r.key} className={`sp-ai ${aiSelected===i?'selected':''}`}
                    onClick={()=>{
                      setAiSelected(i);
                      setProduct(p => ({...p, title: r.text}));
                      showToast('상품명 교체됨');
                    }}>
                    <div className="sp-ai-style"><span className="dot"/>{r.label}</div>
                    <div className="sp-ai-title">{r.text}</div>
                    <div className="sp-ai-len">{r.text.length}자</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SPSection>

        {/* Images + Info — combined, side-panel has room */}
        <SPSection title="상품" meta="이미지 3/3 · 마진 흑자">
          <div style={{marginBottom: 10}}>
            <label className="sp-label" style={{marginBottom: 6, display:'flex'}}>
              이미지
              <span style={{marginLeft:'auto', fontSize:10, color:'var(--ink-3)'}}>
                클릭/드래그로 추가 (최대 3개)
              </span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{display:'none'}}
              onChange={(e) => {
                handleAddImages(e.target.files);
                e.target.value = ''; // 같은 파일 재선택 가능
              }}
            />
            <div className="sp-imgs">
              {[0,1,2].map(i=>{
                const key = product.imgs?.[i];
                const url = key ? imgPreviews[key] : null;
                const isDrag = dragOverIdx === i;
                return (
                  <div key={i}
                    className={`sp-imgslot ${key ? 'filled' : ''}`}
                    style={isDrag ? {borderColor:'var(--accent)', background:'var(--accent-soft)'} : null}
                    onClick={() => { if (!key) openFilePicker(); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverIdx(null);
                      if (e.dataTransfer?.files?.length) {
                        handleAddImages(e.dataTransfer.files);
                      }
                    }}>
                    {key ? (
                      <>
                        {url ? (
                          <div className="fill" style={{backgroundImage: 'url('+url+')'}}/>
                        ) : (
                          <div style={{color:'var(--ink-3)', fontSize:10}}>로딩…</div>
                        )}
                        <div className="idx">{i+1}</div>
                        <button className="rm" onClick={(e)=>{ e.stopPropagation(); handleRemoveImage(i); }}>×</button>
                      </>
                    ) : (
                      <div style={{textAlign:'center'}}>
                        {SPI.plus()}
                        <div style={{marginTop:3, fontSize:10}}>{i+1}번</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sp-field">
            <label className="sp-label">상품명 <span className="req">*</span></label>
            <input className="sp-input" value={product.title}
              onChange={e=>setProduct({...product, title:e.target.value})}/>
          </div>
          <div className="sp-row">
            <div className="sp-field">
              <label className="sp-label">원가</label>
              <div className="sp-num">
                <input type="number" value={product.cost} onChange={e=>setProduct({...product, cost:+e.target.value||0})}/>
                <span className="unit">¥</span>
              </div>
            </div>
            <div className="sp-field">
              <label className="sp-label">판매가</label>
              <div className="sp-num">
                <input type="number" value={product.price} onChange={e=>setProduct({...product, price:+e.target.value||0})}/>
                <span className="unit">₩</span>
              </div>
            </div>
          </div>
          <div className="sp-field">
            <label className="sp-label">
              상품 설명
              <span style={{marginLeft:'auto', fontSize:10, color:'var(--ink-3)'}}>
                <span className="kbd">Alt</span> + <span className="kbd">1~9</span> 템플릿
              </span>
            </label>
            <textarea className="sp-textarea" style={{minHeight:80}} value={product.desc}
              onChange={e=>setProduct({...product, desc:e.target.value})}/>
          </div>

          {/* 태그 */}
          <div className="sp-field">
            <label className="sp-label">
              태그
              <span style={{marginLeft:'auto', fontSize:10, color:'var(--ink-3)'}}>최대 5개 · 쉼표로 구분</span>
            </label>
            <div style={{display:'flex', gap:6}}>
              <input className="sp-input"
                placeholder="예: 일본직구, 정품, 아디다스"
                value={(product.tags || []).join(', ')}
                onChange={e => {
                  const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5);
                  setProduct({...product, tags});
                }}/>
              <button className="sp-btn sm" style={{flexShrink:0, whiteSpace:'nowrap'}}
                onClick={handleGenerateTags} disabled={tagLoading}>
                {tagLoading ? SPI.spin() : SPI.sparkle()} 자동
              </button>
            </div>
            {(product.tags || []).length > 0 && (
              <div style={{display:'flex', gap:4, flexWrap:'wrap', marginTop:4}}>
                {(product.tags || []).map((t,i) => (
                  <span key={i} className="sp-chip accent" style={{fontSize:10}}>#{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* 카테고리 — 대/중/소 3단계 (자동입력 시 순차 클릭) */}
          <div className="sp-field">
            <label className="sp-label">
              카테고리
              <span style={{marginLeft:'auto', fontSize:10, color:'var(--ink-3)'}}>
                대분류 / 중분류 / 소분류
              </span>
            </label>
            <div className="sp-row">
              {[0,1,2].map(i => (
                <input key={i} className="sp-input"
                  placeholder={['대분류','중분류','소분류'][i]}
                  value={product.categoryPath?.[i] || ''}
                  onChange={e => {
                    const next = [...(product.categoryPath || ['','',''])];
                    while (next.length < 3) next.push('');
                    next[i] = e.target.value;
                    // 빈 값 뒤쪽은 잘라냄
                    while (next.length > 0 && !next[next.length-1]) next.pop();
                    setProduct({...product, categoryPath: next});
                  }}/>
              ))}
            </div>
          </div>

          {/* 상품 상태 — 번개장터 실제 값과 동일 */}
          <div className="sp-field">
            <label className="sp-label">상품 상태</label>
            <div style={{display:'flex', gap:5, flexWrap:'wrap'}}>
              {[
                ['새 상품 (미사용)', '새상품'],
                ['사용감 없음',      '없음'],
                ['사용감 적음',      '적음'],
                ['사용감 많음',      '많음'],
                ['고장/파손 상품',   '파손'],
              ].map(([value, label]) => (
                <button key={value}
                  className={`sp-btn sm ${(product.condition ?? '새 상품 (미사용)') === value ? 'primary' : ''}`}
                  style={{flex:'0 0 auto'}}
                  title={value}
                  onClick={() => setProduct({...product, condition: value})}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </SPSection>

        {/* Margin */}
        <SPSection title="마진 계산" meta={
          <span className={`sp-chip ${margin.profit>=0?'success':'danger'}`}>
            {margin.profit>=0?'흑자':'적자'} {margin.profit>=0?'+':''}{margin.pct.toFixed(1)}%
          </span>
        }>
          <div className="sp-margin">
            <div className="sp-margin-row"><span>원가 (환산 {fx}원/엔)</span><span className="v">{Math.round(margin.cost).toLocaleString()}원</span></div>
            <div className="sp-margin-row"><span>배송비</span><span className="v">{shipping.toLocaleString()}원</span></div>
            <div className="sp-margin-row"><span>플랫폼 수수료 ({(feeRate*100).toFixed(1)}%)</span><span className="v">{Math.round(margin.fee).toLocaleString()}원</span></div>
            <div className="sp-margin-total">
              <span style={{fontSize:12, color:'var(--ink-2)', fontWeight:500}}>예상 수익</span>
              <span>
                <span className={`v ${margin.profit>=0?'profit-pos':'profit-neg'}`}>
                  {margin.profit>=0?'+':''}{Math.round(margin.profit).toLocaleString()}원
                </span>
                <span className="pct">{margin.pct>=0?'+':''}{margin.pct.toFixed(1)}%</span>
              </span>
            </div>
          </div>
        </SPSection>

        {/* Templates */}
        <SPSection title="템플릿" meta={`${TPL.length}개`} defaultOpen={false}>
          <div style={{display:'flex', flexDirection:'column', gap:2, marginBottom:10}}>
            {TPL.map((t,i)=>(
              <div key={i} className={`sp-tpl-row ${tplActive===i?'active':''}`} onClick={()=>setTplActive(i)}>
                <div className="sp-tpl-sc">{i+1}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div className="sp-tpl-name">{t.name}</div>
                  <div className="sp-tpl-prev" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                    {t.text.replace(/\n/g,' · ')}
                  </div>
                </div>
                {tplActive===i && SPI.check()}
              </div>
            ))}
          </div>
          <textarea className="sp-textarea" defaultValue={TPL[tplActive].text} style={{minHeight:60}} key={tplActive}/>
          <div className="sp-row" style={{marginTop:8}}>
            <button className="sp-btn block">{SPI.copy()} 복사만</button>
            <button className="sp-btn primary block" onClick={()=>{
              const sep = product.desc.endsWith('\n') || !product.desc ? '' : '\n\n';
              setProduct({...product, desc: product.desc + sep + TPL[tplActive].text});
              showToast('설명에 삽입됨');
            }}>{SPI.plus()} 설명에 삽입</button>
          </div>
        </SPSection>

        {/* Diagnosis — open by default, key value of side panel */}
        <SPSection title="마지막 자동입력 진단" meta={
          diagResults
            ? <span className={`sp-chip ${diagResults.filter(r=>r.ok).length === diagResults.length ? 'success' : diagResults.some(r=>r.ok) ? 'accent' : 'danger'}`}>
                {diagResults.filter(r=>r.ok).length}/{diagResults.length} 성공
              </span>
            : <span className="sp-chip">미실행</span>
        }>
          <div className="sp-diag">
            {diagResults ? diagResults.map((r, i) => (
              <div key={i} className="sp-diag-row">
                <div className={`sp-diag-st ${r.ok ? 'ok' : 'fail'}`}>{r.ok ? SPI.check() : SPI.x()}</div>
                <div className="sp-diag-label">{r.field}</div>
                <div className="sp-diag-val" style={{maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={r.selector || r.error}>
                  {r.selector || r.error || ''}
                </div>
              </div>
            )) : (
              <div className="sp-diag-row" style={{justifyContent:'center', color:'var(--ink-3)', fontSize:11}}>
                자동입력 버튼을 누르면 결과가 표시됩니다
              </div>
            )}
          </div>
          {diagResults && (
            <div className="sp-hint" style={{marginTop:8}}>
              {diagResults.filter(r=>!r.ok).length > 0 ? `실패 ${diagResults.filter(r=>!r.ok).length}개 — 해당 필드는 수동으로 입력해주세요` : '모든 필드 주입 성공 ✓'}
            </div>
          )}
        </SPSection>

        {/* Recent */}
        <SPSection title="최근 등록" meta="3건" defaultOpen={false}>
          <div className="sp-hint" style={{textAlign:'center', padding:'20px 0'}}>
            최근 등록 기록이 여기 표시됩니다
          </div>
        </SPSection>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{
            position:'absolute', inset:0, background:'rgba(0,0,0,.45)',
            zIndex: 100, display:'flex', alignItems:'center', justifyContent:'center',
            padding: 16,
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background:'var(--bg)', borderRadius:12, width:'100%', maxWidth:400,
              maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.4)',
            }}>
            <div style={{
              display:'flex', alignItems:'center', padding:'14px 16px',
              borderBottom:'1px solid var(--line)',
            }}>
              <div style={{flex:1, fontSize:14, fontWeight:600}}>설정</div>
              <button className="sp-icon-btn" onClick={() => setSettingsOpen(false)}>{SPI.x()}</button>
            </div>
            <div style={{padding:16}}>
              {/* Gemini */}
              <div style={{fontSize:11, fontWeight:700, color:'var(--ink-2)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>
                AI · Gemini
              </div>
              <div className="sp-field">
                <label className="sp-label">
                  API 키 <span className="req">*</span>
                  <span style={{marginLeft:'auto', fontSize:10, color:'var(--ink-3)'}}>
                    Google AI Studio에서 발급
                  </span>
                </label>
                <input
                  className="sp-input"
                  type="password"
                  placeholder="AIza..."
                  value={appSettings.apiKey || ''}
                  onChange={(e) => setAppSettings(s => ({...s, apiKey: e.target.value}))}
                />
                <div className="sp-hint" style={{marginTop:4}}>
                  키는 chrome.storage.local에 저장됩니다 (브라우저 외부 전송 없음)
                </div>
              </div>
              <div className="sp-field">
                <label className="sp-label">모델</label>
                <div style={{display:'flex', gap:5}}>
                  {[
                    ['flash', 'Flash', 'gemini-2.0-flash · 빠름'],
                    ['pro',   'Pro',   'gemini-1.5-pro · 고품질'],
                  ].map(([value, label, desc]) => (
                    <button key={value}
                      className={`sp-btn sm ${appSettings.model === value ? 'primary' : ''}`}
                      style={{flex:1, flexDirection:'column', padding:'8px 6px', height:'auto'}}
                      title={desc}
                      onClick={() => setAppSettings(s => ({...s, model: value}))}>
                      <div style={{fontWeight:600}}>{label}</div>
                      <div style={{fontSize:9.5, opacity:.7, marginTop:2}}>{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 마진 계산 */}
              <div style={{fontSize:11, fontWeight:700, color:'var(--ink-2)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:18, marginBottom:8}}>
                마진 계산
              </div>
              <div className="sp-row">
                <div className="sp-field">
                  <label className="sp-label">환율 (원/엔)</label>
                  <div className="sp-num">
                    <input type="number" step="0.1"
                      value={appSettings.fxRate}
                      onChange={(e) => setAppSettings(s => ({...s, fxRate: +e.target.value || 0}))}/>
                    <span className="unit">원/¥</span>
                  </div>
                </div>
                <div className="sp-field">
                  <label className="sp-label">배송비</label>
                  <div className="sp-num">
                    <input type="number"
                      value={appSettings.shipping}
                      onChange={(e) => setAppSettings(s => ({...s, shipping: +e.target.value || 0}))}/>
                    <span className="unit">원</span>
                  </div>
                </div>
                <div className="sp-field">
                  <label className="sp-label">수수료</label>
                  <div className="sp-num">
                    <input type="number" step="0.01"
                      value={appSettings.feeRate}
                      onChange={(e) => setAppSettings(s => ({...s, feeRate: +e.target.value || 0}))}/>
                    <span className="unit">비율</span>
                  </div>
                </div>
              </div>

              {/* 초안 */}
              <div style={{fontSize:11, fontWeight:700, color:'var(--ink-2)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:18, marginBottom:8}}>
                초안 관리
              </div>
              <button className="sp-btn block"
                onClick={async () => {
                  if (typeof chrome !== 'undefined' && chrome.storage) {
                    // 이미지 IndexedDB도 함께 비움
                    for (const k of (product.imgs || [])) {
                      if (typeof k === 'string' && k.startsWith('img:')) {
                        try { await deleteImage(k); } catch {}
                      }
                    }
                    await draftStore.clear();
                  }
                  setProduct({ title:'', cost:0, price:0, desc:'', imgs:[], tags:[] });
                  setAiSelected(null);
                  setAiDesc(null);
                  setImgPreviews({});
                  showToast('초안 삭제됨');
                  setSettingsOpen(false);
                }}>
                현재 초안 + 이미지 삭제
              </button>

              <div style={{display:'flex', justifyContent:'flex-end', marginTop:18}}>
                <button className="sp-btn primary" onClick={() => { setSettingsOpen(false); showToast('설정 저장됨'); }}>
                  완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="sp-toast">{SPI.check()}{toast}</div>}
    </div>
  );
}

export default SidePanel;
