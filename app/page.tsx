"use client";

import { useMemo, useState } from "react";

type Level = {
  strike:number; score:number; gamma:number; delta:number; callIv:number; putIv:number;
  dte:number; oi:number; volume:number; distance:number; side:"CALL"|"PUT"; label:string;
};

const demo:Level[] = [
 {strike:4850,score:94,gamma:.0214,delta:.51,callIv:17.8,putIv:19.9,dte:1,oi:8421,volume:3112,distance:-6,side:"PUT",label:"Gamma Reaction"},
 {strike:4855,score:91,gamma:.0198,delta:.57,callIv:18.0,putIv:19.4,dte:1,oi:10324,volume:4021,distance:-1,side:"CALL",label:"ATM / Gamma"},
 {strike:4860,score:88,gamma:.0181,delta:.43,callIv:18.2,putIv:20.1,dte:1,oi:11984,volume:5140,distance:4,side:"PUT",label:"Put Skew"},
 {strike:4870,score:83,gamma:.0156,delta:.32,callIv:18.7,putIv:20.5,dte:2,oi:15620,volume:6244,distance:14,side:"PUT",label:"Downside Hedge"},
 {strike:4840,score:79,gamma:.0147,delta:.69,callIv:19.1,putIv:19.7,dte:2,oi:7022,volume:1880,distance:-16,side:"CALL",label:"Gamma Zone"},
 {strike:4880,score:72,gamma:.0118,delta:.25,callIv:19.0,putIv:21.3,dte:3,oi:9811,volume:2155,distance:24,side:"PUT",label:"Skew Watch"},
];

function fmt(n:number, d=1){return n.toLocaleString(undefined,{maximumFractionDigits:d});}

export default function Home(){
 const [tab,setTab]=useState("Levels");
 const [dte,setDte]=useState("0–3 DTE");
 const [auto,setAuto]=useState(true);
 const [selected,setSelected]=useState<Level|null>(demo[1]);
 const [optionType,setOptionType]=useState("Tuesday Weekly Options");
 const [expiration,setExpiration]=useState("Week 1: Oct 2026");
 const [strikeRange,setStrikeRange]=useState("Near the Money");
 const [chainLayout,setChainLayout]=useState("Stacked");
 const visibleLevels=useMemo(()=>{
   let rows=dte==="0–1 DTE"?demo.filter(x=>x.dte<=1):dte==="2–3 DTE"?demo.filter(x=>x.dte>=2):demo;
   if(strikeRange==="Near the Money") rows=[...rows].sort((a,b)=>Math.abs(a.distance)-Math.abs(b.distance)).slice(0,3);
   else if(strikeRange==="5 Strikes +/-") rows=rows.filter(x=>Math.abs(x.distance)<=6);
   else if(strikeRange==="20 Strikes +/-") rows=rows.filter(x=>Math.abs(x.distance)<=24);
   else if(strikeRange==="50 Strikes +/-") rows=rows.filter(x=>Math.abs(x.distance)<=50);
   return rows;
 },[dte,strikeRange]);
 const levels=visibleLevels;
 const expirationOptions=optionType==="Monthly Options"?["Week 1: Oct 2026","Week 2: Oct 2026","Week 3: Oct 2026","Week 1: Nov 2026"]:["Week 1: Oct 2026","Week 2: Oct 2026","Week 3: Oct 2026","Week 1: Nov 2026"];

 return <main>
  <header className="topbar">
   <div className="brand"><div className="mark">GC</div><div><div className="brandTitle">COMMAND CENTER</div><div className="brandSub">GOLD OPTIONS INTELLIGENCE</div></div></div>
   <div className="market"><span className="liveDot"/><span>COMEX / GC</span><strong>4,856.20</strong><span className="up">+18.40&nbsp; +0.38%</span></div>
   <div className="topActions"><button className="ghost">Watchlist</button><button className="primary">Trade Setup</button></div>
  </header>

  <section className="hero">
   <div><div className="eyebrow">SHORT-DATED OPTIONS MAP</div><h1>Gold reaction levels</h1><p>Ranked by gamma, proximity, skew, DTE and market activity.</p></div>
   <div className="statusCard"><div><span className="liveDot"/><b>{auto?"LIVE ENGINE":"PAUSED"}</b></div><small>Barchart feed adapter ready</small><button onClick={()=>setAuto(!auto)}>{auto?"Pause refresh":"Resume refresh"}</button></div>
  </section>

  <div className="ticker">
   <div><span>GC</span><b>4,856.20</b><small>FUTURES</small></div>
   <div><span>1D IV</span><b>18.7%</b><small>ATM</small></div>
   <div><span>PUT SKEW</span><b className="warn">+1.6</b><small>VOL POINTS</small></div>
   <div><span>TOP GAMMA</span><b>4,855</b><small>STRIKE</small></div>
   <div><span>ACTIVE DTE</span><b>1</b><small>DAYS</small></div>
  </div>

  <section className="controlBar">
   <div className="controlTitle"><span className="liveDot"/><div><b>BARCHART VIEW</b><small>Adjust the options map</small></div></div>
   <label>OPTIONS TYPE<select value={optionType} onChange={e=>setOptionType(e.target.value)}>{["Monthly Options","Friday Weekly Options","Monday Weekly Options","Tuesday Weekly Options","Wednesday Weekly Options","Thursday Weekly Options"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label>EXPIRATION<select value={expiration} onChange={e=>setExpiration(e.target.value)}>{expirationOptions.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>STRIKES<select value={strikeRange} onChange={e=>setStrikeRange(e.target.value)}>{["5 Strikes +/-","Near the Money","20 Strikes +/-","50 Strikes +/-","Show All"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label>DISPLAY<select value={chainLayout} onChange={e=>setChainLayout(e.target.value)}><option>Stacked</option><option>Side-by-Side</option></select></label>
  </section>

  <nav className="tabs">{["Levels","Option Chain","Skew Map","Method"].map(x=><button className={tab===x?"active":""} onClick={()=>setTab(x)} key={x}>{x}</button>)}</nav>

  {tab==="Levels" && <section className="grid">
   <div className="panel levelsPanel">
    <div className="panelHead"><div><h2>Highest-conviction levels</h2><span>{optionType} • {expiration} • {strikeRange}</span></div><select value={dte} onChange={e=>setDte(e.target.value)}><option>0–3 DTE</option><option>0–1 DTE</option><option>2–3 DTE</option></select></div>
    <div className="table">
     <div className="tr th"><span>RANK</span><span>STRIKE</span><span>SCORE</span><span>GAMMA</span><span>DELTA</span><span>IV SKEW</span><span>OI</span><span>DTE</span></div>
     {levels.map((x,i)=><button className={selected?.strike===x.strike?"tr row selected":"tr row"} onClick={()=>setSelected(x)} key={x.strike}>
      <span className="rank">{String(i+1).padStart(2,"0")}</span><span className="strike">{fmt(x.strike,0)} <em>{x.label}</em></span><span><b className="score">{x.score}</b></span><span>{x.gamma.toFixed(4)}</span><span>{x.delta.toFixed(2)}</span><span className={x.putIv>x.callIv?"warn":""}>{(x.putIv-x.callIv).toFixed(1)}%</span><span>{x.oi.toLocaleString()}</span><span>{x.dte}</span>
     </button>)}
    </div>
   </div>

   <aside className="side">
    <div className="panel setup">
     <div className="panelHead"><div><h2>Trade setup</h2><span>Selected reaction zone</span></div><div className="badge">LONG BIAS</div></div>
     {selected && <><div className="bigStrike">{fmt(selected.strike,0)} <small>STRIKE</small></div><div className="signal"><div><span>CONVICTION</span><b>{selected.score}/100</b></div><div><span>DISTANCE</span><b>{selected.distance>0?"+":""}{selected.distance} pts</b></div></div><div className="meter"><i style={{width:selected.score+"%"}}/></div>
     <div className="reason"><b>Why it matters</b><p>{selected.label} • gamma {selected.gamma.toFixed(4)} • {selected.dte} DTE • {selected.oi.toLocaleString()} OI</p><p>Put IV is {selected.putIv.toFixed(1)}% vs call IV {selected.callIv.toFixed(1)}%, showing downside protection demand.</p></div>
     <div className="levels"><div><span>Entry zone</span><b>{fmt(selected.strike-3,0)}–{fmt(selected.strike+2,0)}</b></div><div><span>Reaction</span><b>{fmt(selected.strike,0)}</b></div><div><span>Invalidation</span><b>{fmt(selected.strike-10,0)}</b></div></div></>}
    </div>
    <div className="panel miniChart"><div className="panelHead"><div><h2>Gamma landscape</h2><span>Near-price concentration</span></div></div><div className="bars">{levels.map(x=><div className="barCol" key={x.strike}><div className="bar" style={{height:(x.gamma/0.0214*100)+"%"}}/><span>{x.strike}</span></div>)}</div></div>
   </aside>
  </section>}

  {tab==="Option Chain" && <section className="panel full"><div className="chainMeta"><div><div className="eyebrow">BARCHART-STYLE OPTIONS CHAIN</div><h2>{optionType}</h2><span>{expiration} • {levels.length} active strikes • Price value of option point: $100</span></div><div className="chainMode">{chainLayout}</div></div><div className={"chainGrid "+(chainLayout==="Side-by-Side"?"sideBySide":"stacked")}><div className="chainSection calls"><div className="chainSectionTitle">Calls</div><div className="chainHeader"><span>Latest</span><span>IV</span><span>Delta</span><span>Gamma</span><span>Theta</span><span>Vega</span><span>IV Skew</span><span>Last Trade</span></div>{levels.map(x=><div className={"optionRow "+(selected?.strike===x.strike?"hot":"")} key={"c"+x.strike} onClick={()=>setSelected(x)}><span>{(x.callIv/100*10).toFixed(2)}</span><span>{x.callIv.toFixed(2)}%</span><span>{x.delta.toFixed(4)}</span><span>{x.gamma.toFixed(4)}</span><span>{(-x.gamma*320).toFixed(2)}</span><span>{(x.gamma*42).toFixed(4)}</span><span>{(x.callIv-x.putIv).toFixed(2)}%</span><span>10/07/26</span></div>)}</div><div className="strikeColumn"><div className="chainSectionTitle">Strike</div>{levels.map(x=><div className={"strikeRow "+(selected?.strike===x.strike?"hot":"")} key={"s"+x.strike} onClick={()=>setSelected(x)}><b>{x.strike.toLocaleString()}</b><small>{x.label}</small></div>)}</div><div className="chainSection puts"><div className="chainSectionTitle">Puts</div><div className="chainHeader"><span>Latest</span><span>IV</span><span>Delta</span><span>Gamma</span><span>Theta</span><span>Vega</span><span>IV Skew</span><span>Last Trade</span></div>{levels.map(x=><div className={"optionRow "+(selected?.strike===x.strike?"hot":"")} key={"p"+x.strike} onClick={()=>setSelected(x)}><span>{(x.putIv/100*10).toFixed(2)}</span><span>{x.putIv.toFixed(2)}%</span><span>{(-Math.abs(1-x.delta)).toFixed(4)}</span><span>{x.gamma.toFixed(4)}</span><span>{(-x.gamma*300).toFixed(2)}</span><span>{(x.gamma*39).toFixed(4)}</span><span>{(x.putIv-x.callIv).toFixed(2)}%</span><span>10/07/26</span></div>)}</div></div></section>}
  {tab==="Skew Map" && <section className="panel full"><div className="skewHero"><div><div className="eyebrow">VOLATILITY SIGNAL</div><h2>Put protection is leading</h2><p>Across the active short-dated strikes, put IV is trading above call IV. That signal is fed into the level score rather than used alone.</p></div><div className="skewNumber">+1.6<span>VOL PTS</span></div></div></section>}
  {tab==="Method" && <section className="panel full"><div className="method"><h2>How the engine ranks a level</h2><div className="methodGrid">{[["01","Gamma","Higher gamma = stronger acceleration / reaction potential."],["02","ATM / Delta","Near-price strikes with delta near 0.50 get priority."],["03","IV Skew","Put vs call IV identifies protection / fear imbalance."],["04","DTE","0–2 DTE gets the strongest short-dated weighting."],["05","Activity","Open interest, volume and fresh trading keep levels alive."],["06","Distance","Levels beyond ~20–30 points lose priority for short-dated setups."]].map(a=><div><span>{a[0]}</span><b>{a[1]}</b><p>{a[2]}</p></div>)}</div></div></section>}

  <footer><span>GC COMMAND CENTER</span><span>Data adapter: Barchart OnDemand • Production credentials required for live feed</span><span>Engine v1.0</span></footer>
 </main>
}
