// mobile.jsx — Mobile PWA scanner inside an iOS frame

const { useState, useEffect, useRef, useMemo } = React;

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

  .m-topbar{
    display:flex; align-items:center; gap:10px;
    padding: 6px 20px 10px;
  }
  .m-topbar h1{
    margin:0; font-size: 24px; font-weight: 700;
    letter-spacing: -0.03em;
  }
  .m-topbar-sub{ color: var(--ink-3); font-size: 13px; font-weight: 500; margin-top: 2px; }

  .m-topbar-icon{
    width: 36px; height: 36px; border-radius: 999px;
    background: var(--chip); display:flex; align-items:center; justify-content:center;
    color: var(--ink-2); border:none;
  }

  /* Tab pill bar */
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

  /* Scrollable body */
  .m-body{ flex:1; overflow-y:auto; padding: 0 16px 28px; -webkit-overflow-scrolling: touch; }
  .m-body::-webkit-scrollbar{ display: none; }

  /* Scanner viewport */
  .m-scan{
    position: relative;
    aspect-ratio: 3/4;
    background: #0a0a0a; border-radius: 20px;
    overflow: hidden;
    margin-bottom: 14px;
    box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.06);
  }
  .m-scan-video{
    position:absolute; inset:0;
    background:
      radial-gradient(ellipse at 50% 40%, #3a3834 0%, #1a1917 60%, #060606 100%);
  }
  .m-scan-product{
    position:absolute; left: 12%; top: 18%; right: 12%; bottom: 18%;
    background: linear-gradient(135deg, rgba(255,200,120,0.15), rgba(200,150,80,0.1));
    border-radius: 10px;
    display:flex; align-items:center; justify-content:center;
    color: rgba(255,255,255,0.25);
    font-family:monospace; font-size: 11px;
  }
  .m-scan-overlay{
    position: absolute; inset: 0;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 16px;
  }
  .m-scan-top{
    display: flex; justify-content: space-between; gap: 8px;
  }
  .m-scan-pill{
    padding: 5px 10px; border-radius: 999px;
    background: rgba(0,0,0,.45); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    color: white; font-size: 11px; font-weight: 600;
    display: flex; align-items: center; gap: 6px;
    letter-spacing: -0.005em;
  }
  .m-scan-pill .live{
    width: 6px; height: 6px; border-radius: 999px;
    background: #ff4d4d; box-shadow: 0 0 6px #ff4d4d;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse{ 50%{opacity:.4} }
  .m-scan-frame{
    position: absolute; inset: 0; display:flex; align-items:center; justify-content:center;
    pointer-events:none;
  }
  .m-scan-window{
    width: 78%; height: 30%;
    border-radius: 14px;
    box-shadow: 0 0 0 9999px rgba(0,0,0,.45);
    position: relative;
  }
  .m-scan-window::before, .m-scan-window::after,
  .m-scan-window > i, .m-scan-window > b{
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

  .m-scan-bottom{
    display: flex; justify-content: center; gap: 14px;
  }
  .m-scan-btn{
    width: 48px; height: 48px; border-radius: 999px;
    background: rgba(255,255,255,.15); backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,.2);
    color: white; display:flex; align-items:center; justify-content:center;
  }
  .m-scan-capture{
    width: 64px; height: 64px; border-radius: 999px;
    background: white; border: 4px solid rgba(255,255,255,.3);
    box-shadow: 0 0 0 1px rgba(0,0,0,.1);
  }

  /* Result card */
  .m-card{
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 16px; padding: 14px;
    margin-bottom: 12px;
  }
  .m-card-head{
    display:flex; align-items:flex-start; gap:10px;
    margin-bottom: 10px;
  }
  .m-thumb{
    width: 52px; height: 52px; border-radius: 10px;
    flex-shrink: 0; background-size:cover; background-position:center;
  }
  .m-card-title{
    font-size: 14.5px; font-weight: 600; letter-spacing:-.02em;
    line-height: 1.3;
  }
  .m-card-meta{
    font-size: 11.5px; color: var(--ink-3); margin-top: 3px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
  }

  /* Margin big display */
  .m-margin{
    padding: 16px;
    border-radius: 16px;
    background:
      linear-gradient(135deg, oklch(68% 0.15 45 / 0.1), oklch(68% 0.15 45 / 0.02)),
      var(--surface);
    border: 1px solid var(--line);
    margin-bottom: 12px;
  }
  .m-margin-label{ font-size: 12px; color: var(--ink-2); font-weight: 500; }
  .m-margin-value{
    font-family: 'JetBrains Mono','SF Mono', monospace;
    font-variant-numeric: tabular-nums;
    font-size: 40px; font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.1;
    margin-top: 2px;
  }
  .m-margin-profit.pos{ color: var(--success); }
  .m-margin-profit.neg{ color: var(--danger); }
  .m-margin-pct{
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px; color: var(--ink-3); font-weight: 500;
    margin-left: 6px;
  }

  .m-row{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .m-field{ display:flex; flex-direction:column; gap: 5px; margin-bottom: 10px; }
  .m-field label{ font-size: 12px; font-weight: 500; color: var(--ink-2); }
  .m-input{
    border: 1px solid var(--line-2); background: var(--surface);
    border-radius: 10px; padding: 12px 14px;
    font-size: 16px; font-family: inherit;
    color: var(--ink);
    letter-spacing: -0.015em;
    -webkit-appearance: none;
    transition: border .12s, box-shadow .12s;
  }
  .m-input:focus{
    outline:none; border-color: var(--accent);
    box-shadow: 0 0 0 3px oklch(68% 0.15 45 / 0.12);
  }
  .m-num{ display:flex; align-items:center;
    border: 1px solid var(--line-2); background: var(--surface);
    border-radius: 10px; padding: 2px 14px;
    transition: border .12s, box-shadow .12s;
  }
  .m-num:focus-within{ border-color: var(--accent); box-shadow: 0 0 0 3px oklch(68% 0.15 45 / 0.12); }
  .m-num input{
    flex:1; border:none; outline:none; background:transparent;
    padding: 12px 0;
    font-size: 18px; font-weight: 600;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    color: var(--ink); min-width:0;
    letter-spacing: -0.01em;
  }
  .m-num .unit{ font-size: 13px; color: var(--ink-3); font-weight: 500; }

  .m-btn{
    border: none; background: var(--chip); color: var(--ink);
    padding: 14px 16px; border-radius: 12px;
    font-family: inherit; font-size: 15px; font-weight: 600;
    display:flex; align-items:center; justify-content:center; gap:8px;
    letter-spacing:-.01em;
    width: 100%;
  }
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

  /* History */
  .m-hist-row{
    display:flex; align-items:center; gap:12px;
    padding: 12px 0; border-bottom: 1px solid var(--line);
  }
  .m-hist-row:last-child{ border-bottom: none; }
  .m-hist-info{ flex: 1; min-width: 0; }
  .m-hist-title{ font-size: 14px; font-weight: 600; letter-spacing:-.015em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .m-hist-meta{ font-size: 11px; color: var(--ink-3); margin-top: 2px; font-family:'JetBrains Mono', monospace; }
  .m-hist-profit{
    font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  /* Photo strip */
  .m-photos{
    display:grid; grid-template-columns: repeat(3, 1fr); gap:6px;
    margin-top: 8px;
  }
  .m-photo{
    aspect-ratio:1; border-radius:10px; background-size:cover; background-position:center;
    position: relative;
  }
  .m-photo .m-photo-i{
    position:absolute; top:4px; left:5px;
    background: rgba(0,0,0,.55); color: white;
    border-radius: 5px; padding: 1px 5px; font-size: 9.5px; font-weight:600;
    font-family: 'JetBrains Mono', monospace;
  }

  .m-section-title{
    font-size: 11px; font-weight: 700; color: var(--ink-3);
    text-transform: uppercase; letter-spacing: 0.08em;
    margin: 6px 0 8px;
  }

  @keyframes toast-up{
    from{ opacity: 0; transform: translate(-50%, 10px); }
    to{ opacity: 1; transform: translate(-50%, 0); }
  }
  .m-toast{
    position: absolute; left: 50%; bottom: 36px;
    transform: translateX(-50%);
    background: var(--ink); color: white;
    padding: 10px 16px; border-radius: 999px;
    font-size: 13px; font-weight: 600;
    animation: toast-up .2s ease-out;
    display:flex; align-items:center; gap:8px;
    box-shadow: 0 6px 20px rgba(0,0,0,.25);
    z-index: 40;
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
};

function stripedBG(seed){
  const pals = [['#f2e6d6','#e2d1b3'],['#e7dfd1','#d0c4ab'],['#eadfd0','#d5c4a8']];
  const [a,b] = pals[seed % pals.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><pattern id='p' width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='8' height='8' fill='${a}'/><rect width='4' height='8' fill='${b}'/></pattern></defs><rect width='100' height='100' fill='url(#p)'/></svg>`;
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg);
}

function MobilePWA({ tweaks }){
  const [tab, setTab] = useState('scan');
  const [scanned, setScanned] = useState(null);
  const [cost, setCost] = useState(8900);
  const [price, setPrice] = useState(139000);
  const [toast, setToast] = useState(null);
  const [photos, setPhotos] = useState([stripedBG(0), stripedBG(1)]);

  function showToast(msg){
    setToast(msg);
    setTimeout(()=>setToast(null), 1600);
  }

  // Auto-simulate scan after mounting
  useEffect(()=>{
    if(tab === 'scan' && !scanned){
      const t = setTimeout(()=>{
        setScanned({
          code: '4901234567894',
          title: 'Adidas Samba OG Core Black',
          brand: 'adidas',
          category: 'スニーカー',
        });
        showToast('바코드 인식 완료');
      }, 2200);
      return ()=>clearTimeout(t);
    }
  }, [tab, scanned]);

  const margin = useMemo(()=>{
    const fx = 9.3, shipping = 3500, feeRate = 0.03;
    const c = cost * fx;
    const fee = price * feeRate;
    const profit = price - c - shipping - fee;
    const pct = price > 0 ? profit / price * 100 : 0;
    return { cost: c, fee, profit, pct };
  }, [cost, price]);

  return (
    <div className={`m-root ${tweaks.dark?'dark':''}`} style={{'--accent': tweaks.accent}}>
      <style>{mobileCss}</style>

      <div className="m-topbar">
        <div style={{flex:1}}>
          <h1>스캐너</h1>
          <div className="m-topbar-sub">매장 현장 도구 · PWA</div>
        </div>
        <button className="m-topbar-icon"><MIcon.history/></button>
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
              <div className="m-scan-video">
                <div className="m-scan-product">product shot</div>
              </div>
              <div className="m-scan-frame">
                <div className="m-scan-window"><i/><b/></div>
                {!scanned && <div className="m-scan-line"/>}
              </div>
              <div className="m-scan-overlay">
                <div className="m-scan-top">
                  <div className="m-scan-pill"><span className="live"/>{scanned ? '검출됨' : '탐색 중'}</div>
                  <div style={{display:'flex', gap:6}}>
                    <button className="m-scan-btn"><MIcon.flash/></button>
                    <button className="m-scan-btn"><MIcon.flip/></button>
                  </div>
                </div>
                <div className="m-scan-bottom">
                  <button className="m-scan-capture" onClick={()=>{
                    setPhotos([...photos, stripedBG(photos.length)].slice(-6));
                    showToast('사진 저장됨 · '+(photos.length+1)+'/6');
                  }}/>
                </div>
              </div>
            </div>

            {scanned && (
              <div className="m-card">
                <div className="m-card-head">
                  <div className="m-thumb" style={{backgroundImage:`url(${stripedBG(0)})`}}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="m-card-title">{scanned.title}</div>
                    <div className="m-card-meta">JAN · {scanned.code}</div>
                    <div style={{marginTop:6, display:'flex', gap:4, flexWrap:'wrap'}}>
                      <span className="m-chip success"><MIcon.check s={10}/> 매칭됨</span>
                      <span className="m-chip">{scanned.brand}</span>
                      <span className="m-chip">{scanned.category}</span>
                    </div>
                  </div>
                </div>
                <div className="m-action-row">
                  <button className="m-btn" onClick={()=>showToast('메루카리 검색 열기')}>
                    <MIcon.merc/> 메루카리 조회
                  </button>
                  <button className="m-btn primary" onClick={()=>setTab('margin')}>
                    ₩ 마진 계산
                  </button>
                </div>
              </div>
            )}

            {photos.length > 0 && (
              <>
                <div className="m-section-title">촬영 ({photos.length})</div>
                <div className="m-photos">
                  {photos.map((p,i)=>(
                    <div key={i} className="m-photo" style={{backgroundImage:`url(${p})`}}>
                      <div className="m-photo-i">{i+1}</div>
                    </div>
                  ))}
                </div>
                <button className="m-btn" style={{marginTop:10}} onClick={()=>showToast(photos.length+'장 다운로드됨')}>
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
            </div>

            <div className="m-field">
              <label>메루카리 원가</label>
              <div className="m-num">
                <input type="number" value={cost} onChange={e=>setCost(+e.target.value||0)}/>
                <span className="unit">¥</span>
              </div>
            </div>
            <div className="m-field">
              <label>번개장터 판매가</label>
              <div className="m-num">
                <input type="number" value={price} onChange={e=>setPrice(+e.target.value||0)}/>
                <span className="unit">원</span>
              </div>
            </div>

            <div className="m-section-title">산출 내역</div>
            <div className="m-card" style={{padding: '12px 14px'}}>
              {[
                ['원가 (환율 9.3원/엔)', Math.round(margin.cost).toLocaleString() + '원'],
                ['배송비', '3,500원'],
                ['수수료 (6%)', Math.round(margin.fee).toLocaleString() + '원'],
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

            <button className="m-btn accent" onClick={()=>showToast('기록에 저장됨')} style={{marginTop:8}}>
              <MIcon.check/> 기록 저장
            </button>
          </>
        )}

        {tab==='history' && (
          <>
            <div className="m-section-title">최근 100건 · 저장됨 3건</div>
            {[
              { t:'아디다스 삼바 OG 블랙 270', c:'¥8,900', p:'₩139,000', profit: 52870, ago: '2시간 전' },
              { t:'New Balance 992 Grey US9', c:'¥22,000', p:'₩248,000', profit: 32860, ago: '어제' },
              { t:'Nike Air Force 1 LV8 White', c:'¥11,500', p:'₩98,000', profit: -12900, ago: '2일 전' },
            ].map((h,i)=>(
              <div key={i} className="m-hist-row">
                <div className="m-thumb" style={{backgroundImage:`url(${stripedBG(i)})`, width:44, height:44}}/>
                <div className="m-hist-info">
                  <div className="m-hist-title">{h.t}</div>
                  <div className="m-hist-meta">{h.c} → {h.p} · {h.ago}</div>
                </div>
                <div className={`m-hist-profit ${h.profit>=0?'pos':'neg'}`}
                  style={{color: h.profit>=0 ? 'var(--success)' : 'var(--danger)'}}>
                  {h.profit>=0?'+':''}{(h.profit/1000).toFixed(1)}k
                </div>
              </div>
            ))}
          </>
        )}

        {toast && <div className="m-toast"><MIcon.check/>{toast}</div>}
      </div>
    </div>
  );
}

window.MobilePWA = MobilePWA;
