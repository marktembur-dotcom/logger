"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BarchartCsvImport from "./components/BarchartCsvImport";

type Row = { symbol:string; type:string; strike:number; bid:number; ask:number; last:number; volume:number; openInterest:number; iv:number; delta:number; gamma:number; theta:number; vega:number; dte:number; expiration:string; tradeTime:string; percentFromLast:number; baseLast:number; };
type Level = { strike:number; score:number; gamma:number; delta:number; callIv:number; putIv:number; dte:number; oi:number; volume:number; distance:number; side:"CALL"|"PUT"; label:string; };

type Mt5Event = {
  id:string; source:"WIN"|"XAU5"|"XAU1"; tier:"early"|"partial"|"confirmed"|"watch";
  signal:string; symbol:string; tf:string; price:number; score?:number; confidence?:string;
  side?:"buy"|"sell"; entry?:number; sl?:number; tp?:number; zoneHigh?:number; zoneLow?:number;
  reason?:string; seq?:string; measuredProb?:number; time:string; receivedAt:string;
};

const empty = {live:false,rows:[] as Row[],error:""};

function scoreRow(c:Row,p:Row,price:number):Level {
  const dte=Math.max(c.dte||p.dte,0), distance=c.strike-price;
  const gamma=Math.max(c.gamma,p.gamma);
  const atm=Math.max(0,1-Math.abs(Math.abs(c.delta)-0.5)*2);
  const skew=p.iv-c.iv;
  const activity=Math.log10(1+Math.max(c.openInterest,p.openInterest)+Math.max(c.volume,p.volume)*2);
  const dist=Math.max(0,1-Math.abs(distance)/30);
  const g=Math.min(1,gamma/(Math.max(c.gamma,p.gamma)||1));
  const dteScore=dte<=2?1:dte<=3?.75:dte<=7?.35:0;
  const raw=30*g+20*atm+15*Math.min(1,Math.max(0,skew/5))+15*dteScore+10*Math.min(1,activity/5)+10*dist;
  return {strike:c.strike,score:Math.round(raw),gamma,delta:Math.abs(c.delta),callIv:c.iv,putIv:p.iv,dte,oi:Math.max(c.openInterest,p.openInterest),volume:Math.max(c.volume,p.volume),distance,side:skew>=0?"PUT":"CALL",label:gamma===c.gamma?"Gamma Reaction":"Gamma Zone"};
}

function fmt(n:number,d=1){return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:d});}
function tierClass(t?:string){ if(t==="confirmed") return "tier confirmed"; if(t==="partial") return "tier partial"; if(t==="early") return "tier early"; return "tier watch"; }
function sideClass(s?:string){ return s==="buy"?"sideBuy":s==="sell"?"sideSell":""; }

function FeedCard({title, feed}:{title:string; feed?:Mt5Event}) {
  return (
    <div className={"feedCard " + (feed ? "on" : "")}>
      <div className="feedHead">
        <b>{title}</b>
        <span className={tierClass(feed?.tier)}>{feed?.tier?.toUpperCase() || "IDLE"}</span>
      </div>
      {feed ? (
        <>
          <div className={"feedSignal " + sideClass(feed.side)}>{feed.signal}</div>
          <div className="feedMeta">
            <div><span>PRICE</span><b>{fmt(feed.price,2)}</b></div>
            <div><span>SCORE</span><b>{feed.score != null ? fmt(feed.score,0) : "—"}</b></div>
            <div><span>TF</span><b>{feed.tf || "—"}</b></div>
            <div><span>CONF</span><b>{feed.confidence || "—"}</b></div>
          </div>
          {(feed.entry || feed.sl || feed.tp) && (
            <div className="feedLevels">
              <div><span>Entry</span><b>{feed.entry != null ? fmt(feed.entry,2) : "—"}</b></div>
              <div><span>SL</span><b>{feed.sl != null ? fmt(feed.sl,2) : "—"}</b></div>
              <div><span>TP</span><b>{feed.tp != null ? fmt(feed.tp,2) : "—"}</b></div>
            </div>
          )}
          {feed.reason && <div className="feedReason">{feed.reason}</div>}
          <div className="feedTime">{new Date(feed.receivedAt || feed.time).toLocaleTimeString()}</div>
        </>
      ) : (
        <div className="feedIdle">Waiting for MT5…</div>
      )}
    </div>
  );
}

export default function Home(){
 const [data,setData]=useState<any>(empty); const [tab,setTab]=useState("Levels"); const [selected,setSelected]=useState<Level|null>(null);
 const csvImportedRef=useRef(false);
 const [strikeRange,setStrikeRange]=useState("Near the Money"); const [layout,setLayout]=useState("Stacked");
 const [mt5,setMt5]=useState<{live:boolean;feeds:Partial<Record<string,Mt5Event>>;events:Mt5Event[]}>({live:false,feeds:{},events:[]});

 useEffect(()=>{const h=(e:any)=>{const rows=e.detail?.rows||[]; if(rows.length){csvImportedRef.current=true; setData({live:true,source:"Barchart CSV Download",fetchedAt:new Date().toISOString(),rows,error:""});setSelected(null);}}; window.addEventListener("barchart-csv",h); return()=>window.removeEventListener("barchart-csv",h)},[]);

 useEffect(()=>{
   let stop=false;
   const pull=async()=>{
     try{
       const r=await fetch("/api/mt5/state",{cache:"no-store"});
       const j=await r.json();
       if(!stop && j?.ok) setMt5({live:!!j.live,feeds:j.feeds||{},events:j.events||[]});
     }catch{}
   };
   pull();
   const id=setInterval(pull,4000);
   return()=>{stop=true; clearInterval(id);};
 },[]);

 const rows:Row[]=data.rows||[];
 const price=rows.find(x=>x.baseLast)?.baseLast||0;
 const calls=rows.filter(x=>x.type.toLowerCase()==="call"), puts=rows.filter(x=>x.type.toLowerCase()==="put");
 const levels=useMemo(()=>{const map=new Map<number,{c?:Row,p?:Row}>(); for(const r of calls){const x=map.get(r.strike)||{};x.c=r;map.set(r.strike,x)} for(const r of puts){const x=map.get(r.strike)||{};x.p=r;map.set(r.strike,x)} return [...map.entries()].filter(([,x])=>x.c&&x.p).map(([s,x])=>scoreRow(x.c!,x.p!,price)).sort((a,b)=>b.score-a.score);},[rows,price]);
 const visible=useMemo(()=>{let x=[...levels]; if(strikeRange==="Near the Money")x=x.sort((a,b)=>Math.abs(a.distance)-Math.abs(b.distance)).slice(0,8); else if(strikeRange==="5 Strikes +/-")x=x.filter(a=>Math.abs(a.distance)<=5*5); else if(strikeRange==="20 Strikes +/-")x=x.filter(a=>Math.abs(a.distance)<=20); else if(strikeRange==="50 Strikes +/-")x=x.filter(a=>Math.abs(a.distance)<=50); return x;},[levels,strikeRange]);
 const top=visible[0]||selected; const atm=levels.length?levels.reduce((a,b)=>Math.abs(a.distance)<Math.abs(b.distance)?a:b):null;
 const putSkew=atm?atm.putIv-atm.callIv:0;
 const maxGamma=Math.max(...visible.map(x=>x.gamma),0.000001);
 const mt5Live=mt5.live || Object.keys(mt5.feeds).length>0;

 return <main>
  <header className="topbar"><div className="brand"><div className="mark">GC</div><div><div className="brandTitle">COMMAND CENTER</div><div className="brandSub">BARCHART + MT5 LIVE</div></div></div><div className="market"><span className={data.live||mt5Live?"liveDot":"liveDot off"}/><span>COMEX / GC</span><strong>{price?fmt(price,2):"—"}</strong><span className={data.live?"up":"warn"}>{data.live?"BARCHART":"CSV OFF"}</span><span className={mt5Live?"up":"warn"}>{mt5Live?"MT5 LIVE":"MT5 IDLE"}</span></div><div className="topActions"><button className="primary" onClick={()=>setTab("Levels")}>Trade Setup</button></div></header>
  <section className="hero"><div><div className="eyebrow">SHORT-DATED OPTIONS + INDICATOR FEEDS</div><h1>Gold reaction levels</h1><p>Real Barchart Greeks ranked by gamma, skew and DTE — plus early / partial / confirmed MT5 signals.</p></div><div className="statusCard"><div><span className={data.live||mt5Live?"liveDot":"liveDot off"}/><b>{data.live||mt5Live?"LIVE ENGINE":"WAITING FOR DATA"}</b></div><small>{data.live?"Barchart CSV loaded":"Import Barchart CSV"} · {mt5Live?"MT5 feeds active":"MT5 bridge idle"}</small></div></section>
  <BarchartCsvImport />

  <section className="feedStack">
    <div className="feedStackHead"><b>MT5 SIGNAL STACK</b><small>Early · Partial · Confirmed from WIN / XAU 5M / XAU 1M</small></div>
    <div className="feedGrid">
      <FeedCard title="WIN" feed={mt5.feeds.WIN} />
      <FeedCard title="XAU 5M" feed={mt5.feeds.XAU5} />
      <FeedCard title="XAU 1M" feed={mt5.feeds.XAU1} />
    </div>
  </section>

  <div className="ticker"><div><span>GC</span><b>{price?fmt(price,2):"—"}</b><small>FUTURES</small></div><div><span>ATM IV</span><b>{atm?fmt((atm.callIv+atm.putIv)/2,2)+"%":"—"}</b><small>NEAREST STRIKE</small></div><div><span>PUT SKEW</span><b className="warn">{atm?fmt(putSkew,2):"—"}</b><small>VOL POINTS</small></div><div><span>TOP GAMMA</span><b>{top?fmt(top.strike,0):"—"}</b><small>STRIKE</small></div><div><span>ACTIVE DTE</span><b>{top?.dte??"—"}</b><small>DAYS</small></div></div>
  <section className="controlBar"><div className="controlTitle"><span className={data.live?"liveDot":"liveDot off"}/><div><b>BARCHART VIEW</b><small>Controls filter the live rows</small></div></div><label>STRIKES<select value={strikeRange} onChange={e=>setStrikeRange(e.target.value)}>{["5 Strikes +/-","Near the Money","20 Strikes +/-","50 Strikes +/-","Show All"].map(x=><option key={x}>{x}</option>)}</select></label><label>DISPLAY<select value={layout} onChange={e=>setLayout(e.target.value)}><option>Stacked</option><option>Side-by-Side</option></select></label><label>DTE<select defaultValue="0–3 DTE"><option>0–3 DTE</option><option>0–7 DTE</option><option>All</option></select></label></section>
  <nav className="tabs">{["Levels","Option Chain","Skew Map","MT5 Tape","Method"].map(x=><button className={tab===x?"active":""} onClick={()=>setTab(x)} key={x}>{x}</button>)}</nav>
  {tab==="Levels"&&<section className="grid"><div className="panel levelsPanel"><div className="panelHead"><div><h2>Highest-conviction levels</h2><span>{rows.length} live Barchart option rows</span></div></div><div className="table"><div className="tr th"><span>RANK</span><span>STRIKE</span><span>SCORE</span><span>GAMMA</span><span>DELTA</span><span>IV SKEW</span><span>OI</span><span>DTE</span></div>{visible.map((x,i)=><button className={top?.strike===x.strike?"tr row selected":"tr row"} onClick={()=>setSelected(x)} key={x.strike}><span className="rank">{String(i+1).padStart(2,"0")}</span><span className="strike">{fmt(x.strike,0)} <em>{x.label}</em></span><span><b className="score">{x.score}</b></span><span>{x.gamma.toFixed(5)}</span><span>{x.delta.toFixed(3)}</span><span className={x.putIv>x.callIv?"warn":""}>{(x.putIv-x.callIv).toFixed(2)}%</span><span>{fmt(x.oi,0)}</span><span>{x.dte}</span></button>)}</div></div>
  <aside className="side"><div className="panel setup"><div className="panelHead"><div><h2>Trade setup</h2><span>Selected live reaction zone</span></div><div className="badge">{top?.side||"—"} BIAS</div></div>{top?<><div className="bigStrike">{fmt(top.strike,0)} <small>STRIKE</small></div><div className="signal"><div><span>CONVICTION</span><b>{top.score}/100</b></div><div><span>DISTANCE</span><b>{top.distance>0?"+":""}{fmt(top.distance,1)} pts</b></div></div><div className="meter"><i style={{width:top.score+"%"}}/></div><div className="reason"><b>Why it matters</b><p>Gamma {top.gamma.toFixed(5)} • {top.dte} DTE • {fmt(top.oi,0)} OI • {fmt(top.volume,0)} volume.</p><p>Put IV {top.putIv.toFixed(2)}% vs call IV {top.callIv.toFixed(2)}%.</p></div><div className="levels"><div><span>Entry zone</span><b>{fmt(top.strike-3,0)}–{fmt(top.strike+2,0)}</b></div><div><span>Reaction</span><b>{fmt(top.strike,0)}</b></div><div><span>Invalidation</span><b>{fmt(top.strike-10,0)}</b></div></div></>:<div className="empty">No live Barchart rows loaded.</div>}</div><div className="panel miniChart"><div className="panelHead"><div><h2>Gamma landscape</h2><span>Actual Barchart gamma</span></div></div><div className="bars">{visible.map(x=><div className="barCol" key={x.strike}><div className="bar" style={{height:(x.gamma/maxGamma*100)+"%"}}/><span>{fmt(x.strike,0)}</span></div>)}</div></div></aside></section>}
  {tab==="Option Chain"&&<section className="panel full"><div className="chainMeta"><div><div className="eyebrow">ACTUAL BARCHART OPTIONS CHAIN</div><h2>GCZ26</h2><span>{rows.length} rows • fetched {data.fetchedAt?new Date(data.fetchedAt).toLocaleTimeString():"—"}</span></div><div className="chainMode">{layout}</div></div><div className={"chainGrid "+(layout==="Side-by-Side"?"sideBySide":"stacked")}><div className="chainSection calls"><div className="chainSectionTitle">Calls</div><div className="chainHeader"><span>Latest</span><span>IV</span><span>Delta</span><span>Gamma</span><span>Theta</span><span>Vega</span><span>OI</span><span>Last Trade</span></div>{visible.map(x=>{const r=calls.find(q=>q.strike===x.strike);return r&&<div className="optionRow" key={"c"+x.strike}><span>{fmt(r.last,2)}</span><span>{fmt(r.iv,2)}%</span><span>{r.delta.toFixed(4)}</span><span>{r.gamma.toFixed(5)}</span><span>{r.theta.toFixed(4)}</span><span>{r.vega.toFixed(4)}</span><span>{fmt(r.openInterest,0)}</span><span>{r.tradeTime||"—"}</span></div>})}</div><div className="strikeColumn"><div className="chainSectionTitle">Strike</div>{visible.map(x=><div className="strikeRow" key={"s"+x.strike}><b>{fmt(x.strike,0)}</b><small>{x.label}</small></div>)}</div><div className="chainSection puts"><div className="chainSectionTitle">Puts</div><div className="chainHeader"><span>Latest</span><span>IV</span><span>Delta</span><span>Gamma</span><span>Theta</span><span>Vega</span><span>OI</span><span>Last Trade</span></div>{visible.map(x=>{const r=puts.find(q=>q.strike===x.strike);return r&&<div className="optionRow" key={"p"+x.strike}><span>{fmt(r.last,2)}</span><span>{fmt(r.iv,2)}%</span><span>{r.delta.toFixed(4)}</span><span>{r.gamma.toFixed(5)}</span><span>{r.theta.toFixed(4)}</span><span>{r.vega.toFixed(4)}</span><span>{fmt(r.openInterest,0)}</span><span>{r.tradeTime||"—"}</span></div>})}</div></div></section>}
  {tab==="Skew Map"&&<section className="panel full"><div className="skewHero"><div><div className="eyebrow">VOLATILITY SIGNAL</div><h2>{putSkew>=0?"Put protection is leading":"Call IV is leading"}</h2><p>This is calculated directly from the live Barchart call/put IV at the nearest active strike.</p></div><div className="skewNumber">{putSkew>=0?"+":""}{fmt(putSkew,2)}<span>VOL PTS</span></div></div></section>}
  {tab==="MT5 Tape"&&<section className="panel full"><div className="panelHead"><div><h2>MT5 event tape</h2><span>Early · Partial · Confirmed — real posts from your terminal</span></div></div><div className="tape">{mt5.events.length?mt5.events.map(e=><div className={"tapeRow "+e.tier} key={e.id}><span className="tapeSrc">{e.source}</span><span className={tierClass(e.tier)}>{e.tier}</span><span className={"tapeSig "+sideClass(e.side)}>{e.signal}</span><span>{fmt(e.price,2)}</span><span>{e.score!=null?e.score:"—"}</span><span>{e.tf||"—"}</span><span>{new Date(e.receivedAt||e.time).toLocaleTimeString()}</span></div>):<div className="empty">No MT5 events yet. Enable WebRequest + WebBridge in MT5.</div>}</div></section>}
  {tab==="Method"&&<section className="panel full"><div className="method"><h2>How the live engine ranks a level</h2><div className="methodGrid">{[["01","Gamma","Higher live gamma = stronger acceleration / reaction potential."],["02","ATM / Delta","Near-price strikes with delta near 0.50 get priority."],["03","IV Skew","Put vs call IV identifies protection / fear imbalance."],["04","DTE","0–2 DTE gets the strongest short-dated weighting."],["05","Activity","Live OI and volume keep levels active."],["06","Distance","Levels beyond ~30 points lose priority."]].map(a=><div key={a[0]}><span>{a[0]}</span><b>{a[1]}</b><p>{a[2]}</p></div>)}</div></div></section>}
  <footer><span>GC COMMAND CENTER</span><span>{data.live ? `SOURCE: ${data.source || "BARCHART CSV DOWNLOAD"}` : "SOURCE: BARCHART CSV DOWNLOAD"} · MT5 BRIDGE</span><span>early / partial / confirmed</span></footer>
 </main>
}
