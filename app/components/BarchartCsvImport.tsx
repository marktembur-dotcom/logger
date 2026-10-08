"use client";

import { useRef, useState } from "react";

type ImportedRow = {
  symbol:string; type:string; strike:number; bid:number; ask:number; last:number;
  volume:number; openInterest:number; iv:number; delta:number; gamma:number; theta:number; vega:number;
  dte:number; expiration:string; tradeTime:string; percentFromLast:number; baseLast:number;
};

function n(v:string){ const x=Number(String(v??"").replace(/[%,$,]/g,"").trim()); return Number.isFinite(x)?x:0; }
function clean(v:string){ return String(v??"").replace(/^"|"$/g,"").trim(); }

function parseCsv(text:string): ImportedRow[] {
  const lines = text.replace(/\r/g,"").split("\n").filter(x=>x.trim());
  if (!lines.length) return [];
  const rows:string[][]=[];
  for (const line of lines) {
    const out:string[]=[]; let cur=""; let q=false;
    for(let i=0;i<line.length;i++){ const ch=line[i];
      if(ch==='"'){ if(q && line[i+1]==='"'){cur+='"';i++;} else q=!q; }
      else if(ch===',' && !q){out.push(cur);cur="";} else cur+=ch;
    }
    out.push(cur); rows.push(out);
  }
  const header=rows[0].map(clean);
  const idx=(name:string, start=0)=>header.findIndex((h,i)=>i>=start && h.toLowerCase().replace(/[^a-z0-9]/g,"")===name.toLowerCase().replace(/[^a-z0-9]/g,""));
  const findAny=(names:string[], start=0)=>{for(const name of names){const i=idx(name,start);if(i>=0)return i;}return -1;};
  const strike=findAny(["Strike","Strike Price"]);
  if(strike<0) throw new Error("This is not a Barchart options/Vol-Greeks CSV: Strike column not found.");

  const mid=Math.floor(header.length/2);
  const callStrike=strike<mid?strike:strike;
  const callCols={symbol:findAny(["Symbol","Contract"]),type:findAny(["Type","Option Type"]),strike:callStrike,bid:findAny(["Bid","Bid Price"]),ask:findAny(["Ask","Ask Price"]),last:findAny(["Latest","Last","Last Price"]),volume:findAny(["Volume"]),oi:findAny(["Open Int","Open Interest"]),iv:findAny(["IV","Implied Volatility","Volatility"]),delta:findAny(["Delta"]),gamma:findAny(["Gamma"]),theta:findAny(["Theta"]),vega:findAny(["Vega"]),exp:findAny(["Expiration","Expiration Date"]),time:findAny(["Last Trade","Trade Time","Time"])};
  const putStart = header.findIndex((h,i)=>i>mid && /strike/i.test(h));
  const putBase = putStart>0?putStart:mid;
  const putCols={symbol:findAny(["Symbol","Contract"],putBase),type:findAny(["Type","Option Type"],putBase),strike:findAny(["Strike","Strike Price"],putBase),bid:findAny(["Bid","Bid Price"],putBase),ask:findAny(["Ask","Ask Price"],putBase),last:findAny(["Latest","Last","Last Price"],putBase),volume:findAny(["Volume"],putBase),oi:findAny(["Open Int","Open Interest"],putBase),iv:findAny(["IV","Implied Volatility","Volatility"],putBase),delta:findAny(["Delta"],putBase),gamma:findAny(["Gamma"],putBase),theta:findAny(["Theta"],putBase),vega:findAny(["Vega"],putBase),exp:findAny(["Expiration","Expiration Date"],putBase),time:findAny(["Last Trade","Trade Time","Time"],putBase)};

  function make(r:string[],c:any,type:string):ImportedRow|null{
    const strikeV=n(r[c.strike]); if(!strikeV)return null;
    const expiration=clean(c.exp>=0?r[c.exp]:"");
    const dte=expiration?Math.max(0,Math.ceil((new Date(expiration+"T23:59:59").getTime()-Date.now())/86400000)):0;
    return {symbol:clean(c.symbol>=0?r[c.symbol]:"GC"),type:type.toLowerCase().includes("put")?"put":type.toLowerCase().includes("call")?"call":type.toLowerCase(),strike:strikeV,bid:n(c.bid>=0?r[c.bid]:""),ask:n(c.ask>=0?r[c.ask]:""),last:n(c.last>=0?r[c.last]:""),volume:n(c.volume>=0?r[c.volume]:""),openInterest:n(c.oi>=0?r[c.oi]:""),iv:n(c.iv>=0?r[c.iv]:""),delta:n(c.delta>=0?r[c.delta]:""),gamma:n(c.gamma>=0?r[c.gamma]:""),theta:n(c.theta>=0?r[c.theta]:""),vega:n(c.vega>=0?r[c.vega]:""),dte,expiration,tradeTime:clean(c.time>=0?r[c.time]:""),percentFromLast:0,baseLast:0};
  }
  const out:ImportedRow[]=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i];
    const a=make(r,callCols,"call"); if(a)out.push(a);
    const b=make(r,putCols,"put"); if(b)out.push(b);
  }
  if(!out.length) throw new Error("Barchart CSV was read, but no option rows were found.");
  const base=out.filter(x=>x.strike).reduce((a,b)=>a, out[0]);
  return out.map(x=>({...x,baseLast:base.baseLast}));
}

export default function BarchartCsvImport(){
  const input=useRef<HTMLInputElement>(null); const [msg,setMsg]=useState("");
  function open(){window.open("https://www.barchart.com/futures/quotes/GCZ26/volatility-greeks/IY6V26?futuresOptionsView=split","_blank","noopener,noreferrer");}
  function choose(){input.current?.click();}
  function read(file:File){
    const reader=new FileReader();
    reader.onload=()=>{try{
      const rows=parseCsv(String(reader.result||""));
      window.dispatchEvent(new CustomEvent("barchart-csv",{detail:{rows,source:file.name}}));
      setMsg(rows.length+" rows imported");
    }catch(e){setMsg(e instanceof Error?e.message:"Could not read CSV");}};
    reader.readAsText(file);
  }
  return <div className="importBox">
    <div><b>BARCHART CSV</b><small>Use Barchart's own Download button — no scraping.</small></div>
    <div className="importActions"><button className="ghost" onClick={open}>Open Barchart</button><button className="primary" onClick={choose}>Import Downloaded CSV</button><input ref={input} type="file" accept=".csv,text/csv" hidden onChange={e=>{const f=e.target.files?.[0];if(f)read(f);e.currentTarget.value=""}}/></div>
    {msg&&<span className="importMsg">{msg}</span>}
  </div>;
}
