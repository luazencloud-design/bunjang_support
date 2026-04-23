// popup.jsx — Chrome extension popup (420×600)
// Notion/Arc feel: warm neutral, spacious, minimal dividers.

const { useState, useEffect, useRef, useMemo } = React;

// ──────────────────────────────────────────────────────────
// Tokens
// ──────────────────────────────────────────────────────────
const popupCss = `
  .pop-root{
    --bg: #fbfaf7;
    --surface: #ffffff;
    --ink: #1d1a16;
    --ink-2: #5d574d;
    --ink-3: #9a938a;
    --line: rgba(29,26,22,.07);
    --line-2: rgba(29,26,22,.12);
    --chip: #f4f1ec;
    --chip-hover: #ece8e1;
    --accent: oklch(68% 0.15 45);
    --accent-ink: #ffffff;
    --accent-soft: oklch(96% 0.03 60);
    --success: oklch(60% 0.14 150);
    --success-soft: oklch(96% 0.04 150);
    --danger: oklch(58% 0.18 25);
    --danger-soft: oklch(96% 0.04 25);
    --radius: 10px;
    --radius-lg: 14px;
    font-family: 'Pretendard', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--ink);
    background: var(--bg);
    width: 420px; height: 600px;
    display: flex; flex-direction: column;
    overflow: hidden;
    font-feature-settings: 'cv11','ss01';
    letter-spacing: -0.01em;
    font-size: 13px;
    line-height: 1.45;
  }
  .pop-root *{box-sizing:border-box}
  .pop-root button{font-family:inherit}

  .pop-header{
    display:flex; align-items:center; gap:10px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }
  .pop-logo{
    width: 26px; height: 26px; border-radius: 7px;
    background: linear-gradient(145deg, var(--accent), oklch(62% 0.17 30));
    display:flex; align-items:center; justify-content:center;
    color:white; font-weight:700; font-size:12px;
    box-shadow: 0 1px 0 rgba(255,255,255,.3) inset, 0 2px 6px oklch(68% 0.15 45 / 0.35);
    letter-spacing: -0.03em;
  }
  .pop-title{
    font-size: 13.5px; font-weight: 600; letter-spacing: -0.015em;
  }
  .pop-sub{
    font-size: 11px; color: var(--ink-3); font-weight: 500;
  }
  .pop-header-actions{ margin-left:auto; display:flex; gap:4px; }
  .pop-icon-btn{
    width:28px; height:28px; border-radius: 7px;
    border: none; background: transparent; cursor: pointer;
    color: var(--ink-2);
    display:flex; align-items:center; justify-content:center;
  }
  .pop-icon-btn:hover{ background: var(--chip); color: var(--ink); }

  .pop-tabs{
    display:flex; padding: 0 8px; gap:2px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }
  .pop-tab{
    flex:1; border:none; background:transparent;
    padding: 10px 4px 11px; font-size: 12px; font-weight:500;
    color: var(--ink-3); cursor:pointer; position:relative;
    font-family:inherit; letter-spacing:-.01em;
    display:flex; align-items:center; justify-content:center; gap:6px;
  }
  .pop-tab:hover{ color: var(--ink-2); }
  .pop-tab.active{ color: var(--ink); }
  .pop-tab.active::after{
    content:''; position:absolute; left:10%; right:10%; bottom:-1px;
    height:2px; background: var(--ink); border-radius: 2px;
  }
  .pop-tab-count{
    font-size: 10px; padding: 1px 5px; border-radius: 99px;
    background: var(--chip); color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  .pop-tab.active .pop-tab-count{ background: var(--ink); color: white; }

  .pop-body{
    flex:1; overflow-y: auto; padding: 14px 16px 20px;
    scroll-behavior: smooth;
  }
  .pop-body::-webkit-scrollbar{ width: 8px; }
  .pop-body::-webkit-scrollbar-thumb{ background: var(--line-2); border-radius:8px; }

  .pop-section{ margin-bottom: 18px; }
  .pop-section-head{
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom: 8px;
  }
  .pop-section-title{
    font-size: 11px; font-weight: 600; color: var(--ink-3);
    text-transform: uppercase; letter-spacing: 0.06em;
  }

  .pop-field{ display:flex; flex-direction:column; gap:5px; margin-bottom:10px; }
  .pop-label{ font-size: 11.5px; font-weight:500; color: var(--ink-2); }
  .pop-label .req{ color: var(--accent); margin-left:2px; }
  .pop-input, .pop-textarea{
    width:100%; border:1px solid var(--line-2); background: var(--surface);
    border-radius: 8px; padding: 9px 11px; font-size: 13px;
    color: var(--ink); font-family:inherit;
    transition: border .12s, box-shadow .12s;
    letter-spacing:-.01em;
  }
  .pop-textarea{ resize:vertical; min-height: 72px; line-height: 1.5; }
  .pop-input:focus, .pop-textarea:focus{
    outline:none; border-color: var(--accent);
    box-shadow: 0 0 0 3px oklch(68% 0.15 45 / .12);
  }
  .pop-input::placeholder, .pop-textarea::placeholder{ color: var(--ink-3); }

  .pop-row{ display:flex; gap: 8px; }
  .pop-row > *{ flex: 1; min-width: 0; }

  .pop-num-input{
    display:flex; align-items:center; gap:6px;
    border:1px solid var(--line-2); background: var(--surface);
    border-radius: 8px; padding: 2px 10px 2px 11px; transition: border .12s, box-shadow .12s;
  }
  .pop-num-input:focus-within{ border-color: var(--accent); box-shadow: 0 0 0 3px oklch(68% 0.15 45 / .12); }
  .pop-num-input input{
    flex:1; border:none; outline:none; background:transparent;
    padding: 9px 0; font-size:13px; color: var(--ink); font-family:'JetBrains Mono','SF Mono',monospace;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }
  .pop-num-input .unit{ font-size: 11px; color: var(--ink-3); font-weight:500; }

  .pop-btn{
    border:none; background:var(--chip); color:var(--ink);
    padding: 9px 14px; border-radius: 8px;
    font-size: 12.5px; font-weight: 500; cursor:pointer;
    font-family:inherit; letter-spacing:-.01em;
    display: inline-flex; align-items:center; gap:6px; justify-content:center;
    transition: background .12s, transform .06s, box-shadow .12s;
  }
  .pop-btn:hover{ background: var(--chip-hover); }
  .pop-btn:active{ transform: translateY(1px); }
  .pop-btn.primary{
    background: var(--ink); color:white;
  }
  .pop-btn.primary:hover{ background:#000; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
  .pop-btn.accent{
    background: var(--accent); color: white;
  }
  .pop-btn.accent:hover{ filter: brightness(1.05); box-shadow: 0 2px 10px oklch(68% 0.15 45 / 0.35); }
  .pop-btn.ghost{ background: transparent; }
  .pop-btn.ghost:hover{ background: var(--chip); }
  .pop-btn.block{ width:100%; padding: 11px 14px; }
  .pop-btn.sm{ padding: 6px 10px; font-size: 11.5px; }

  /* Image drop */
  .pop-imgs{
    display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
  }
  .pop-imgslot{
    aspect-ratio: 1/1; background: var(--surface);
    border: 1.5px dashed var(--line-2); border-radius: 9px;
    display:flex; align-items:center; justify-content:center;
    color: var(--ink-3); cursor: pointer;
    position: relative; overflow: hidden;
    transition: border-color .12s, background .12s;
    font-size: 10px;
  }
  .pop-imgslot:hover{ border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
  .pop-imgslot.filled{ border-style:solid; border-color: transparent; padding:0; }
  .pop-imgslot.filled:hover .pop-img-remove{ opacity:1; }
  .pop-img-remove{
    position:absolute; top:4px; right:4px; width:20px; height:20px;
    border-radius: 5px; background: rgba(0,0,0,.6); color:white;
    border:none; cursor:pointer; font-size: 13px; line-height:1;
    display:flex; align-items:center; justify-content:center;
    opacity:0; transition:opacity .12s;
  }
  .pop-img-idx{
    position:absolute; top:5px; left:6px;
    background: rgba(0,0,0,.55); color: white;
    border-radius: 4px; padding: 1px 5px; font-size: 9.5px; font-weight:600;
    font-family: 'JetBrains Mono', monospace;
  }
  .pop-imgfill{
    width:100%; height:100%; background-size:cover; background-position:center;
  }

  /* Margin calculator */
  .pop-margin{
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-lg); padding: 14px 16px;
    display:flex; flex-direction:column; gap: 8px;
  }
  .pop-margin-row{
    display:flex; align-items:center; justify-content:space-between;
    font-size: 12px; color: var(--ink-2);
  }
  .pop-margin-row .v{ font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; color: var(--ink); }
  .pop-margin-result{
    display:flex; align-items:baseline; justify-content:space-between;
    padding-top: 10px; margin-top: 4px; border-top: 1px dashed var(--line-2);
  }
  .pop-margin-result .label{ font-size: 12px; font-weight:500; color:var(--ink-2); }
  .pop-margin-result .v{
    font-family:'JetBrains Mono', monospace; font-variant-numeric: tabular-nums;
    font-weight: 600; font-size: 20px; letter-spacing: -0.02em;
  }
  .pop-margin-pct{ font-size: 11px; color: var(--ink-3); margin-left: 6px; font-family:'JetBrains Mono',monospace; }
  .profit-positive{ color: var(--success); }
  .profit-negative{ color: var(--danger); }

  /* AI styles */
  .ai-card{
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 12px;
    transition: border .12s, box-shadow .12s;
    cursor: pointer; position: relative;
  }
  .ai-card:hover{ border-color: var(--line-2); }
  .ai-card.selected{ border-color: var(--ink); box-shadow: 0 0 0 3px oklch(20% 0 0 / 0.06); }
  .ai-card .ai-style{
    font-size: 10px; font-weight: 600; color: var(--accent);
    text-transform: uppercase; letter-spacing: 0.05em;
    display:flex; align-items:center; gap:5px;
    margin-bottom: 6px;
  }
  .ai-card .ai-style .dot{
    width: 6px; height: 6px; border-radius: 99px; background: var(--accent);
  }
  .ai-card .ai-title{
    font-size: 13px; line-height: 1.45; letter-spacing:-.01em;
    color: var(--ink); font-weight: 500;
    word-break: keep-all; overflow-wrap: break-word;
  }
  .ai-card .ai-len{
    position: absolute; top: 12px; right: 12px;
    font-size: 10px; color: var(--ink-3);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Template list */
  .tpl-row{
    display:flex; align-items:center; gap: 10px;
    padding: 10px 12px; border-radius: 8px;
    cursor: pointer; border: 1px solid transparent;
    transition: background .12s, border .12s;
  }
  .tpl-row:hover{ background: var(--surface); border-color: var(--line); }
  .tpl-row.active{ background: var(--surface); border-color: var(--line-2); }
  .tpl-shortcut{
    width: 22px; height: 22px; border-radius: 5px;
    background: var(--chip); color: var(--ink-2);
    display:flex; align-items:center; justify-content:center;
    font-size: 11px; font-weight:600; font-family:'JetBrains Mono',monospace;
    flex-shrink: 0;
  }
  .tpl-row.active .tpl-shortcut{ background: var(--ink); color:white; }
  .tpl-name{ flex:1; font-size: 12.5px; font-weight: 500; }
  .tpl-preview{ font-size: 11px; color: var(--ink-3); margin-top: 2px; font-weight:400; }

  /* Diagnosis */
  .diag-row{
    display:flex; align-items:center; gap: 10px;
    padding: 8px 12px; font-size: 12px;
    border-bottom: 1px solid var(--line);
  }
  .diag-row:last-child{ border-bottom: none; }
  .diag-status{
    width: 18px; height: 18px; border-radius: 99px;
    display:flex; align-items:center; justify-content:center;
    font-size: 10px; flex-shrink:0;
  }
  .diag-status.ok{ background: var(--success-soft); color: var(--success); }
  .diag-status.fail{ background: var(--danger-soft); color: var(--danger); }
  .diag-label{ flex:1; color: var(--ink-2); }
  .diag-val{ font-family:'JetBrains Mono',monospace; font-size: 11px; color: var(--ink-3); }

  /* Toggles */
  .pop-toggle{
    width: 30px; height: 18px; border-radius: 99px;
    background: var(--line-2); position: relative; cursor: pointer;
    transition: background .14s;
    flex-shrink: 0;
  }
  .pop-toggle.on{ background: var(--ink); }
  .pop-toggle::after{
    content:''; position:absolute; top:2px; left:2px;
    width: 14px; height: 14px; border-radius: 99px; background: white;
    transition: transform .14s; box-shadow: 0 1px 2px rgba(0,0,0,.2);
  }
  .pop-toggle.on::after{ transform: translateX(12px); }

  /* Floating action bar */
  .pop-actions{
    position: sticky; bottom: 0; left: 0; right: 0;
    padding: 12px 16px 14px;
    background: linear-gradient(to top, var(--bg) 70%, transparent);
    display: flex; gap: 8px;
    margin: 0 -16px -20px;
  }

  .pop-select{
    border:1px solid var(--line-2); background: var(--surface);
    border-radius: 8px; padding: 9px 11px; font-size:13px;
    color:var(--ink); font-family:inherit;
    cursor:pointer;
  }

  .pop-chip{
    display:inline-flex; align-items:center; gap:5px;
    background: var(--chip); color: var(--ink-2);
    padding: 3px 8px; border-radius: 99px;
    font-size: 10.5px; font-weight: 500;
  }
  .pop-chip.accent{ background: var(--accent-soft); color: var(--accent); }
  .pop-chip.success{ background: var(--success-soft); color: var(--success); }
  .pop-chip.danger{ background: var(--danger-soft); color: var(--danger); }

  .pop-empty{
    text-align: center; padding: 30px 20px;
    color: var(--ink-3); font-size: 12px;
  }

  .pop-hint{
    font-size: 10.5px; color: var(--ink-3);
    display: flex; align-items: center; gap: 4px;
  }
  .kbd{
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    padding: 1px 5px; border-radius: 4px;
    background: var(--chip); color: var(--ink-2);
    border: 1px solid var(--line);
  }

  /* Toast */
  @keyframes toast-in{
    from{ opacity: 0; transform: translate(-50%, 8px); }
    to{ opacity: 1; transform: translate(-50%, 0); }
  }
  .pop-toast{
    position: absolute; left: 50%; bottom: 70px;
    transform: translateX(-50%);
    background: var(--ink); color: white;
    padding: 9px 14px; border-radius: 8px;
    font-size: 12px; font-weight: 500;
    animation: toast-in .18s ease-out;
    display: flex; align-items:center; gap:8px;
    box-shadow: 0 4px 18px rgba(0,0,0,.2);
    z-index: 50;
  }

  @keyframes spin{ to{ transform: rotate(360deg); } }
  .pop-spin{ animation: spin 0.9s linear infinite; display: inline-flex; }

  /* Dark mode */
  .pop-root.dark{
    --bg: #17161a;
    --surface: #1e1d21;
    --ink: #eceae5;
    --ink-2: #a6a39d;
    --ink-3: #6b6862;
    --line: rgba(255,255,255,.07);
    --line-2: rgba(255,255,255,.12);
    --chip: rgba(255,255,255,.06);
    --chip-hover: rgba(255,255,255,.1);
    --accent-soft: oklch(30% 0.06 45);
    --success-soft: oklch(24% 0.05 150);
    --danger-soft: oklch(26% 0.08 25);
  }
  .pop-root.dark .pop-btn.primary{ background: #fff; color: #000; }
  .pop-root.dark .pop-btn.primary:hover{ background: #f0f0f0; }
`;

// ──────────────────────────────────────────────────────────
// Icons
// ──────────────────────────────────────────────────────────
const Icon = {
  sparkle:({s=14}={})=> (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L9.3 6.2L14 7.5L9.3 8.8L8 13.5L6.7 8.8L2 7.5L6.7 6.2L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M12.5 1.5L12.9 3L14.5 3.5L12.9 4L12.5 5.5L12.1 4L10.5 3.5L12.1 3L12.5 1.5Z" fill="currentColor"/>
    </svg>
  ),
  arrow:({s=12}={})=> (<svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M3 6h6m0 0L6 3m3 3L6 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  check:({s=12}={})=> (<svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  x:({s=12}={})=> (<svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  plus:({s=12}={})=> (<svg width={s} height={s} viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  settings:({s=16}={})=>(<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1.5V3M8 13V14.5M3.5 3.5L4.5 4.5M11.5 11.5L12.5 12.5M1.5 8H3M13 8H14.5M3.5 12.5L4.5 11.5M11.5 4.5L12.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  copy:({s=14}={})=>(<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M3 11.5V3.5C3 2.67 3.67 2 4.5 2H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  image:({s=14}={})=>(<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="6" cy="6.5" r="1" fill="currentColor"/><path d="M2.5 12L6 9L8.5 11L10.5 9L13.5 12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>),
  cart:({s=14}={})=>(<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M2 2H3.5L5 10H13L14.5 4H4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="13" r="1" fill="currentColor"/><circle cx="12" cy="13" r="1" fill="currentColor"/></svg>),
  carrot:({s=14}={})=>(<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M11 3.5L9.5 2L2.5 9L4 13.5L8 12L13.5 6.5L11 3.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M9 5L11 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>),
  history:({s=14}={})=>(<svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 1 0 1.8-4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M2 2v3h3M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  spinner:({s=12}={})=>(<svg width={s} height={s} viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/><path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
};

// ──────────────────────────────────────────────────────────
// Placeholder image (striped)
// ──────────────────────────────────────────────────────────
function stripedDataURL(seed){
  const colors = [
    ['#e8dfd3','#d8cab7'],
    ['#dfd5c4','#c9bba3'],
    ['#d3c5ad','#b8a689'],
  ];
  const [a,b] = colors[seed % colors.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
    <defs><pattern id='p' width='10' height='10' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>
    <rect width='10' height='10' fill='${a}'/><rect width='5' height='10' fill='${b}'/>
    </pattern></defs><rect width='120' height='120' fill='url(#p)'/>
    <text x='60' y='67' text-anchor='middle' font-family='monospace' font-size='10' fill='#5d574d' opacity='.7'>product</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg);
}

// ──────────────────────────────────────────────────────────
// Main popup
// ──────────────────────────────────────────────────────────
function ExtensionPopup({ tweaks }){
  const [tab, setTab] = useState('main');
  const [product, setProduct] = useState({
    title: '아디다스 삼바 OG 블랙 화이트 270',
    cost: 8900,
    price: 139000,
    desc: '일본 직구 정품. 2024년 구매, 2회 착용. 박스/택 포함.\n사이즈 US 9.5 (270mm).',
    imgs: [stripedDataURL(0), stripedDataURL(1), stripedDataURL(2)],
  });

  const [fx] = useState(9.3);
  const [shipping] = useState(3500);
  const [feeRate] = useState(0.03);

  const margin = useMemo(()=>{
    const cost = product.cost * fx;
    const fee = product.price * feeRate;
    const profit = product.price - cost - shipping - fee;
    const pct = product.price > 0 ? (profit / product.price) * 100 : 0;
    return { cost, fee, profit, pct };
  }, [product, fx, shipping, feeRate]);

  const [toast, setToast] = useState(null);
  function showToast(msg){
    setToast(msg);
    setTimeout(()=>setToast(null), 1800);
  }

  const root = useRef(null);

  return (
    <div className={`pop-root ${tweaks.dark ? 'dark':''}`} ref={root}
      style={{
        '--accent': tweaks.accent,
      }}>
      <style>{popupCss}</style>

      <div className="pop-header">
        <div className="pop-logo">B</div>
        <div style={{lineHeight:1.2}}>
          <div className="pop-title">등록 도우미</div>
          <div className="pop-sub">번개장터 · 당근마켓</div>
        </div>
        <div className="pop-header-actions">
          <button className="pop-icon-btn" title="기록"><Icon.history /></button>
          <button className="pop-icon-btn" title="설정" onClick={()=>setTab('settings')}><Icon.settings /></button>
        </div>
      </div>

      <div className="pop-tabs">
        <button className={`pop-tab ${tab==='main'?'active':''}`} onClick={()=>setTab('main')}>상품</button>
        <button className={`pop-tab ${tab==='ai'?'active':''}`} onClick={()=>setTab('ai')}>
          <Icon.sparkle s={12}/> AI 이름
        </button>
        <button className={`pop-tab ${tab==='tpl'?'active':''}`} onClick={()=>setTab('tpl')}>
          템플릿 <span className="pop-tab-count">6</span>
        </button>
        <button className={`pop-tab ${tab==='settings'?'active':''}`} onClick={()=>setTab('settings')}>설정</button>
      </div>

      <div className="pop-body">
        {tab==='main' && <TabMain product={product} setProduct={setProduct} margin={margin} onToast={showToast} />}
        {tab==='ai' && <TabAI product={product} setProduct={setProduct} onToast={showToast} />}
        {tab==='tpl' && <TabTemplates product={product} setProduct={setProduct} onToast={showToast} />}
        {tab==='settings' && <TabSettings fx={fx} shipping={shipping} feeRate={feeRate} tweaks={tweaks}/>}

        {tab==='main' && (
          <div className="pop-actions">
            <button className="pop-btn accent block" onClick={()=>showToast('번개장터 자동입력 시작...')}>
              <Icon.cart/> 번개장터 자동입력
            </button>
            <button className="pop-btn block" onClick={()=>showToast('당근 복사 + 열기 완료')}>
              <Icon.carrot/> 당근 복사
            </button>
          </div>
        )}
      </div>

      {toast && <div className="pop-toast"><Icon.check/>{toast}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Tab: Main
// ──────────────────────────────────────────────────────────
function TabMain({ product, setProduct, margin, onToast }){
  function setImg(i, url){
    const next = [...product.imgs];
    next[i] = url;
    setProduct({...product, imgs: next});
  }
  return (
    <>
      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">이미지</div>
          <span className="pop-hint">최대 3장 · 자동 리사이즈</span>
        </div>
        <div className="pop-imgs">
          {[0,1,2].map(i=>(
            <div key={i} className={`pop-imgslot ${product.imgs[i] ? 'filled':''}`}
              onClick={()=>{
                if(product.imgs[i]) return;
                setImg(i, stripedDataURL(Math.floor(Math.random()*3)));
                onToast('이미지 추가됨');
              }}
            >
              {product.imgs[i] ? (
                <>
                  <div className="pop-imgfill" style={{backgroundImage:`url(${product.imgs[i]})`}}/>
                  <div className="pop-img-idx">{i+1}</div>
                  <button className="pop-img-remove" onClick={(e)=>{e.stopPropagation(); setImg(i, null);}}>×</button>
                </>
              ) : (
                <div style={{textAlign:'center', fontWeight:500, letterSpacing:'-.01em'}}>
                  <Icon.plus s={16}/>
                  <div style={{marginTop:4}}>{i+1}번</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">상품 정보</div>
        </div>
        <div className="pop-field">
          <label className="pop-label">상품명 <span className="req">*</span></label>
          <input className="pop-input" value={product.title}
            onChange={e=>setProduct({...product, title:e.target.value})}/>
        </div>
        <div className="pop-row">
          <div className="pop-field">
            <label className="pop-label">메루카리 원가</label>
            <div className="pop-num-input">
              <input type="number" value={product.cost}
                onChange={e=>setProduct({...product, cost: +e.target.value || 0})}/>
              <span className="unit">¥</span>
            </div>
          </div>
          <div className="pop-field">
            <label className="pop-label">판매가</label>
            <div className="pop-num-input">
              <input type="number" value={product.price}
                onChange={e=>setProduct({...product, price: +e.target.value || 0})}/>
              <span className="unit">₩</span>
            </div>
          </div>
        </div>
        <div className="pop-field">
          <label className="pop-label">상품 설명</label>
          <textarea className="pop-textarea" value={product.desc}
            onChange={e=>setProduct({...product, desc:e.target.value})}/>
          <div className="pop-hint" style={{justifyContent:'space-between'}}>
            <span>템플릿에서 <span className="kbd">Alt</span> + <span className="kbd">1~9</span> 로 삽입</span>
            <span>{product.desc.length}자</span>
          </div>
        </div>
      </div>

      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">마진</div>
          <span className={`pop-chip ${margin.profit>=0?'success':'danger'}`}>
            {margin.profit >= 0 ? '흑자' : '적자'}
          </span>
        </div>
        <div className="pop-margin">
          <div className="pop-margin-row">
            <span>원가 (환산)</span>
            <span className="v">{Math.round(margin.cost).toLocaleString()}원</span>
          </div>
          <div className="pop-margin-row">
            <span>배송비</span>
            <span className="v">3,500원</span>
          </div>
          <div className="pop-margin-row">
            <span>수수료 (3%)</span>
            <span className="v">{Math.round(margin.fee).toLocaleString()}원</span>
          </div>
          <div className="pop-margin-result">
            <span className="label">예상 수익</span>
            <span>
              <span className={`v ${margin.profit>=0?'profit-positive':'profit-negative'}`}>
                {margin.profit >= 0 ? '+' : ''}{Math.round(margin.profit).toLocaleString()}원
              </span>
              <span className="pop-margin-pct">{margin.pct >= 0 ? '+' : ''}{margin.pct.toFixed(1)}%</span>
            </span>
          </div>
        </div>
      </div>

      <DiagnosisBlock />
    </>
  );
}

function DiagnosisBlock(){
  const [open, setOpen] = useState(false);
  return (
    <div className="pop-section">
      <div className="pop-section-head">
        <div className="pop-section-title">마지막 등록 진단</div>
        <button className="pop-btn sm ghost" onClick={()=>setOpen(!open)}>
          {open ? '접기' : '펼치기'}
        </button>
      </div>
      {open && (
        <div style={{border:'1px solid var(--line)', borderRadius:'var(--radius)', background:'var(--surface)'}}>
          {[
            ['상품명', 'ok', 'input[name="name"]'],
            ['가격', 'ok', 'input[type="number"]'],
            ['설명', 'ok', 'textarea[name="description"]'],
            ['이미지', 'ok', '3/3 업로드'],
            ['카테고리', 'fail', '수동 선택 필요'],
            ['배송비', 'fail', '수동 선택 필요'],
          ].map(([label, st, val], i)=>(
            <div key={i} className="diag-row">
              <div className={`diag-status ${st}`}>
                {st==='ok' ? <Icon.check s={10}/> : <Icon.x s={10}/>}
              </div>
              <div className="diag-label">{label}</div>
              <div className="diag-val">{val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Tab: AI
// ──────────────────────────────────────────────────────────
const AI_STYLES = [
  { key: 'seo', label: '최대 검색 노출', text: '아디다스 삼바 OG 클래식 블랙 화이트 270 US 9.5 정품 일본직구 스니커즈' },
  { key: 'simple', label: '간결 직관', text: '아디다스 삼바 OG 블랙 270mm' },
  { key: 'rare', label: '한정 · 희소성', text: '일본 한정 아디다스 삼바 OG 블랙 화이트 270 · 국내 소량' },
  { key: 'cond', label: '상태 · 컨디션', text: '[S급] 아디다스 삼바 OG 정품 블랙 화이트 270 / 2회 착용' },
  { key: 'jp', label: '일본어 병기', text: '아디다스 삼바 OG 블랙 270 サンバ クラシック 正規品' },
];

function TabAI({ product, setProduct, onToast }){
  const [brand, setBrand] = useState('아디다스');
  const [model, setModel] = useState('삼바 OG');
  const [color, setColor] = useState('블랙 화이트');
  const [size, setSize] = useState('270mm / US 9.5');
  const [special, setSpecial] = useState('일본 한정, S급');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(AI_STYLES);
  const [selected, setSelected] = useState(null);

  function regenerate(){
    setLoading(true);
    setSelected(null);
    setTimeout(()=>{
      setResults(AI_STYLES);
      setLoading(false);
    }, 900);
  }

  function apply(){
    if(selected == null) return;
    setProduct({...product, title: results[selected].text});
    onToast('상품명 적용됨');
  }

  return (
    <>
      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">속성 입력</div>
          <span className="pop-chip accent"><Icon.sparkle s={10}/> Haiku 4.5</span>
        </div>
        <div className="pop-row">
          <div className="pop-field">
            <label className="pop-label">브랜드</label>
            <input className="pop-input" value={brand} onChange={e=>setBrand(e.target.value)}/>
          </div>
          <div className="pop-field">
            <label className="pop-label">모델</label>
            <input className="pop-input" value={model} onChange={e=>setModel(e.target.value)}/>
          </div>
        </div>
        <div className="pop-row">
          <div className="pop-field">
            <label className="pop-label">색상</label>
            <input className="pop-input" value={color} onChange={e=>setColor(e.target.value)}/>
          </div>
          <div className="pop-field">
            <label className="pop-label">사이즈</label>
            <input className="pop-input" value={size} onChange={e=>setSize(e.target.value)}/>
          </div>
        </div>
        <div className="pop-field">
          <label className="pop-label">특징 (선택)</label>
          <input className="pop-input" value={special} onChange={e=>setSpecial(e.target.value)} placeholder="한정판, 미사용, 정품 보증서 포함…"/>
        </div>
        <button className="pop-btn primary block" onClick={regenerate} disabled={loading}>
          {loading ? <><span className="pop-spin"><Icon.spinner/></span> 생성 중…</> : <><Icon.sparkle s={12}/> 5가지 상품명 생성</>}
        </button>
      </div>

      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">생성된 상품명</div>
          {selected != null && <span className="pop-hint">클릭해서 선택됨</span>}
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {results.map((r, i)=>(
            <div key={r.key}
              className={`ai-card ${selected===i ? 'selected':''}`}
              onClick={()=>setSelected(i)}
            >
              <div className="ai-style"><span className="dot"/>{r.label}</div>
              <div className="ai-title">{r.text}</div>
              <div className="ai-len">{r.text.length}자</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pop-actions">
        <button className="pop-btn block" onClick={()=>navigator.clipboard?.writeText(selected!=null?results[selected].text:'')}>
          <Icon.copy/> 복사
        </button>
        <button className="pop-btn primary block" disabled={selected==null} onClick={apply}>
          <Icon.check/> 적용하기
        </button>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Tab: Templates
// ──────────────────────────────────────────────────────────
const DEFAULT_TEMPLATES = [
  { name: '배송 안내', text: '📦 구매 확정 후 1~2일 내 출고됩니다.\nCJ대한통운 기준, 제주/도서산간 추가 배송비 3,000원.' },
  { name: '정품 보증', text: '✅ 100% 정품 보증. 일본 공식 스토어 또는 메루카리 정품 판매자 매입건입니다. 가품 의심 시 전액 환불해드립니다.' },
  { name: '문의 안내', text: '💬 채팅으로 문의 주시면 빠르게 답변드립니다. 실측 사이즈, 컨디션 사진 요청 가능합니다.' },
  { name: '상품 상태', text: '🏷️ 상품 상태: S급 (미사용에 가까움) / 박스·택 포함.\n사용감 있는 부분은 상세 사진에 별도 표기했습니다.' },
  { name: '반품 정책', text: '↩️ 단순 변심 반품 가능 (수령 후 7일 이내, 왕복 배송비 구매자 부담).' },
  { name: '네고 정책', text: '💸 네고 문의는 정중하게 부탁드립니다. 과도한 할인 요청은 답변드리지 않을 수 있습니다.' },
];

function TabTemplates({ product, setProduct, onToast }){
  const [active, setActive] = useState(0);
  const [text, setText] = useState(DEFAULT_TEMPLATES[0].text);

  function select(i){
    setActive(i);
    setText(DEFAULT_TEMPLATES[i].text);
  }
  function insert(){
    const sep = product.desc.endsWith('\n') || product.desc === '' ? '' : '\n\n';
    setProduct({...product, desc: product.desc + sep + text});
    onToast('설명에 삽입됨');
  }

  return (
    <>
      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">기본 템플릿</div>
          <button className="pop-btn sm ghost"><Icon.plus s={10}/> 새로 만들기</button>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:2}}>
          {DEFAULT_TEMPLATES.map((t, i)=>(
            <div key={i} className={`tpl-row ${active===i ? 'active':''}`} onClick={()=>select(i)}>
              <div className="tpl-shortcut">{i+1}</div>
              <div style={{flex:1, minWidth:0}}>
                <div className="tpl-name">{t.name}</div>
                <div className="tpl-preview" style={{
                  overflow:'hidden', textOverflow:'ellipsis',
                  whiteSpace:'nowrap'
                }}>{t.text.replace(/\n/g,' · ')}</div>
              </div>
              {active===i && <Icon.check s={14}/>}
            </div>
          ))}
        </div>
      </div>

      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">편집 · 미리보기</div>
          <span className="pop-hint">원본은 보존</span>
        </div>
        <textarea className="pop-textarea" value={text} onChange={e=>setText(e.target.value)}
          style={{minHeight: 120}}/>
      </div>

      <div className="pop-actions">
        <button className="pop-btn block" onClick={()=>{navigator.clipboard?.writeText(text); onToast('복사됨');}}>
          <Icon.copy/> 복사만
        </button>
        <button className="pop-btn primary block" onClick={insert}>
          <Icon.arrow/> 설명에 삽입
        </button>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Tab: Settings
// ──────────────────────────────────────────────────────────
function TabSettings({ fx, shipping, feeRate, tweaks }){
  return (
    <>
      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">계산 기본값</div>
        </div>
        <div className="pop-row">
          <div className="pop-field">
            <label className="pop-label">환율 (원/엔)</label>
            <div className="pop-num-input">
              <input type="number" step="0.01" defaultValue={fx}/>
              <span className="unit">₩/¥</span>
            </div>
          </div>
          <div className="pop-field">
            <label className="pop-label">배송비</label>
            <div className="pop-num-input">
              <input type="number" defaultValue={shipping}/>
              <span className="unit">원</span>
            </div>
          </div>
        </div>
        <div className="pop-field">
          <label className="pop-label">플랫폼 수수료</label>
          <div className="pop-num-input">
            <input type="number" step="0.1" defaultValue={feeRate*100}/>
            <span className="unit">%</span>
          </div>
        </div>
      </div>

      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">Claude API</div>
        </div>
        <div className="pop-field">
          <label className="pop-label">API 키</label>
          <input className="pop-input" type="password" placeholder="sk-ant-api03-..." defaultValue="sk-ant-api03-••••••••••••••••••••••"/>
          <div className="pop-hint">브라우저에서 직접 호출 · anthropic-dangerous-direct-browser-access</div>
        </div>
        <div className="pop-field">
          <label className="pop-label">모델</label>
          <select className="pop-select">
            <option>claude-haiku-4-5 (빠름, 저렴)</option>
            <option>claude-sonnet-4-5 (품질 우선)</option>
          </select>
        </div>
      </div>

      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">동작</div>
        </div>
        {[
          ['번개장터 자동입력 후 등록 버튼 자동 클릭', false, '안전상 비권장'],
          ['이미지 업로드 전 자동 리사이즈', true, '1600px, JPEG 85%'],
          ['당근 복사 시 이미지 자동 다운로드', true, ''],
          ['진단 창 항상 표시', false, ''],
        ].map(([label, def, sub], i)=>{
          const [on, setOn] = useState(def);
          return (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 0', borderTop: i>0 ? '1px solid var(--line)':'none'
            }}>
              <div style={{flex:1}}>
                <div style={{fontSize:12.5, fontWeight:500}}>{label}</div>
                {sub && <div className="pop-hint" style={{marginTop:2}}>{sub}</div>}
              </div>
              <div className={`pop-toggle ${on?'on':''}`} onClick={()=>setOn(!on)}/>
            </div>
          );
        })}
      </div>

      <div className="pop-section">
        <div className="pop-section-head">
          <div className="pop-section-title">버전</div>
        </div>
        <div className="pop-hint" style={{fontSize:11.5}}>
          v1.1.0 · Manifest V3 · 수강생 무료 배포판
        </div>
      </div>
    </>
  );
}

window.ExtensionPopup = ExtensionPopup;
