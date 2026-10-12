"use client";

import { useEffect, useMemo, useRef } from "react";

type Feed = { source: string; tier?: string; signal?: string; price?: number; active: boolean };
type Level = { strike: number; score: number; side: string };

export default function DataFlowTree({ feeds, levels, eventCount, csvLive, price }: {
  feeds: Feed[]; levels: Level[]; eventCount: number; csvLive: boolean; price: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const model = useMemo(() => {
    const active = feeds.some(f => f.active);
    return {
      sources: [
        { id: "mt5", label: "MT5 SIGNALS", value: active ? "CONNECTED" : "WAITING", color: "#55f2c4", live: active },
        { id: "chart", label: "BARCHART DATA", value: csvLive ? "IMPORT READY" : "NO IMPORT", color: "#ffc86b", live: csvLive },
        { id: "spot", label: "GOLD SPOT", value: price ? price.toFixed(2) : "PRICE WAITING", color: "#79aaff", live: !!price },
      ],
      feeds: feeds.slice(0, 4).map(f => ({ label: f.source, value: f.active ? (f.tier || "ACTIVE").toUpperCase() : "IDLE", color: f.tier === "confirmed" ? "#55f2c4" : f.tier === "partial" ? "#ffc86b" : "#79aaff", live: f.active })),
      levels: levels.slice(0, 4).map(l => ({ label: String(l.strike), value: (l.side || "ZONE").toUpperCase() + " · " + l.score, color: l.side?.toLowerCase() === "sell" ? "#ff7b9c" : "#55f2c4", live: true })),
      activeCount: feeds.filter(f => f.active).length + (csvLive ? 1 : 0) + (price ? 1 : 0),
    };
  }, [feeds, levels, eventCount, csvLive, price]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0, t = 0, width = 0, height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const p = canvas.parentElement;
      if (!p) return;
      width = p.clientWidth; height = p.clientHeight;
      canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px"; canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    const rounded = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    };
    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, width, height);
      const compact = width < 360;
      const left = compact ? 16 : 22, right = width - left;
      const center = width / 2;
      const topY = 22;
      const sourceY = Math.max(54, height * 0.29);
      const feedY = Math.min(height - 76, Math.max(sourceY + 42, height * 0.54));
      const levelY = Math.min(height - 38, Math.max(feedY + 34, height * 0.76));
      const sinkY = height - 11;
      const sourceXs = [left + (right-left)*.17, center, right - (right-left)*.17];
      const branchXs = [left + (right-left)*.13, left + (right-left)*.37, left + (right-left)*.63, right - (right-left)*.13];
      const strokeBranch = (x1:number,y1:number,x2:number,y2:number,color:string,phase:number,thick=1.3) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.bezierCurveTo(x1,y1+18,x2,y2-18,x2,y2);
        ctx.strokeStyle = color; ctx.lineWidth = thick; ctx.stroke();
        // Only the connector itself moves: subtle dashes travel along the steady line.
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.bezierCurveTo(x1,y1+18,x2,y2-18,x2,y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, thick * 1.05);
        ctx.setLineDash([4, 13]);
        ctx.lineDashOffset = -(t * 7 + phase * 17);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      };
      // Atmospheric backdrop: a dark forest of fine vertical filaments, not a circuit grid.
      const haze = ctx.createRadialGradient(center, height*.48, 2, center, height*.48, width*.75);
      haze.addColorStop(0,"rgba(49,210,184,.065)"); haze.addColorStop(.55,"rgba(36,75,130,.035)"); haze.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle = haze; ctx.fillRect(0,0,width,height);
      ctx.lineWidth = 1;
      for (let i=0;i<18;i++) {
        const x = (i/17)*width;
        ctx.beginPath(); ctx.moveTo(x,0); ctx.bezierCurveTo(x,height*.3,x,height*.65,x,height);
        ctx.strokeStyle = "rgba(102,190,205,.025)"; ctx.stroke();
      }
      // One bright trunk feeds three major limbs; each limb branches to its live data leaves.
      const trunk = "#75f5e2";
      strokeBranch(center,topY+10,center,sourceY-18,"rgba(117,245,226,.65)",0,.0+2);
      sourceXs.forEach((x,i) => strokeBranch(center,sourceY-18,x,sourceY,i===0?"rgba(85,242,196,.65)":i===1?"rgba(255,200,107,.65)":"rgba(121,170,255,.65)",i*.23,1.7));
      model.sources.forEach((s,i) => {
        const x=sourceXs[i], y=sourceY;
        strokeBranch(x,y+17,branchXs[i],feedY-16,s.color+"99",i*.17,1.2);
        if (i===0) model.feeds.forEach((f,j) => {
          const bx=branchXs[j], by=feedY;
          strokeBranch(sourceXs[0],sourceY+18,bx,by,f.color+"88",j*.13,1.1);
        });
        if (i===1) model.levels.forEach((l,j) => {
          const bx=branchXs[j], by=levelY;
          strokeBranch(sourceXs[1],sourceY+18,bx,by,l.color+"88",j*.12+.2,1.1);
        });
      });
      // Draw clear, pill-shaped source nodes.
      const node = (x:number,y:number,label:string,value:string,color:string,wide:number,large=false) => {
        const h=large?36:31, xx=Math.max(2,Math.min(width-wide-2,x-wide/2)), yy=Math.max(2,Math.min(height-h-2,y-h/2));
        ctx.save();
        ctx.shadowColor=color; ctx.shadowBlur=0;
        rounded(xx,yy,wide,h,8);
        ctx.fillStyle="rgba(5,13,24,.94)"; ctx.fill();
        ctx.strokeStyle=color+"bb"; ctx.lineWidth=large?1.4:1; ctx.stroke();
        ctx.shadowBlur=0;
        ctx.fillStyle=color; ctx.beginPath(); ctx.arc(xx+9,yy+10,2.6,0,Math.PI*2); ctx.fill();
        ctx.textAlign="left"; ctx.textBaseline="middle";
        ctx.font=large?"700 9px 'IBM Plex Mono',monospace":"600 8px 'IBM Plex Mono',monospace";
        ctx.fillStyle="#f1fffd"; ctx.fillText(label,xx+16,yy+10);
        ctx.font="7px 'IBM Plex Mono',monospace"; ctx.fillStyle=color;
        ctx.fillText(value,xx+8,yy+23);
        ctx.restore();
      };
      // Core beacon.
      const pulse=1;
      ctx.beginPath(); ctx.arc(center,topY,10*pulse,0,Math.PI*2); ctx.fillStyle="rgba(117,245,226,.07)"; ctx.fill();
      ctx.beginPath(); ctx.arc(center,topY,5*pulse,0,Math.PI*2); ctx.fillStyle=trunk; ctx.shadowBlur=0; ctx.fill();
      ctx.font="700 9px 'IBM Plex Mono',monospace"; ctx.textAlign="center"; ctx.fillStyle="#eafffb"; ctx.fillText("GC COMMAND CORE",center,topY-14);
      model.sources.forEach((s,i)=>node(sourceXs[i],sourceY,s.label,s.value,s.color,compact?86:112,true));
      model.feeds.forEach((f,i)=>node(branchXs[i],feedY,f.label,f.value,f.color,compact?68:88));
      model.levels.forEach((l,i)=>node(branchXs[i],levelY,l.label,l.value,l.color,compact?68:88));
      // Converging trunk and terminal dashboard.
      const convergenceY=sinkY-14;
      [0,1,2].forEach((i)=>strokeBranch(sourceXs[i],sourceY+20,center,convergenceY,trunk+"55",i*.31,.9));
      ctx.beginPath(); ctx.arc(center,convergenceY,3.2,0,Math.PI*2); ctx.fillStyle="#75f5e2"; ctx.shadowBlur=0; ctx.fill();
      const label="GOLD LAB";
      ctx.font="700 8px 'IBM Plex Mono',monospace"; ctx.textAlign="center"; ctx.fillStyle="#eafffb"; ctx.fillText(label,center,sinkY-1);
      ctx.font="7px 'IBM Plex Mono',monospace"; ctx.fillStyle="rgba(157,194,203,.9)"; ctx.fillText(eventCountLabel(),center,sinkY+8);
      function eventCountLabel(){ return eventCount + " EVENTS  /  " + levels.length + " ZONES"; }
      raf=requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [model, eventCount, levels.length]);

  return <div className="treeWrap treeWrap--organic">
    <div className="treeHead"><div><b>DATA FLOW TREE</b><small>LIVE BRANCH NETWORK · SOURCE → CONFLUENCE</small></div><span className="neuralBadge">{model.activeCount} LIVE</span></div>
    <div className="treeBody"><canvas ref={canvasRef} className="treeCanvas" /></div>
  </div>;
}
