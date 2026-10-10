"use client";

import { useEffect, useMemo, useRef } from "react";

type Feed = { source: string; tier?: string; signal?: string; price?: number; active: boolean };
type Level = { strike: number; score: number; side: string };

export default function DataFlowTree({ feeds, levels, eventCount, csvLive, price }: {
  feeds: Feed[]; levels: Level[]; eventCount: number; csvLive: boolean; price: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graph = useMemo(() => {
    const root = { id: "core", x: 160, y: 24, label: "GC CORE", sub: csvLive || eventCount ? "LIVE" : "STANDBY", tone: "cyan" };
    const activeMt5 = feeds.some(f => f.active);
    const sources = [
      { id: "mt5", x: 55, y: 72, label: "MT5 BRIDGE", sub: activeMt5 ? "UP" : "IDLE", tone: activeMt5 ? "green" : "muted" },
      { id: "csv", x: 160, y: 72, label: "BARCHART", sub: csvLive ? "LOADED" : "OFF", tone: csvLive ? "green" : "muted" },
      { id: "px", x: 265, y: 72, label: "SPOT", sub: price ? price.toFixed(2) : "—", tone: price ? "cyan" : "muted" },
    ];
    const feedNodes = feeds.map((f, i) => ({
      id: f.source, x: [40, 100, 160][i] ?? 40 + i * 60, y: 120, label: f.source,
      sub: f.active ? (f.tier || "ON").toUpperCase() : "IDLE",
      tone: f.tier === "confirmed" ? "green" : f.tier === "partial" ? "amber" : f.active ? "cyan" : "muted",
      active: f.active,
    }));
    const levelNodes = levels.slice(0, 3).map((l, i) => ({
      id: "L" + l.strike, x: 220 + i * 35, y: 151, label: String(l.strike), sub: String(l.score), tone: "cyan", active: true,
    }));
    const sink = { id: "dash", x: 160, y: 182, label: "DASHBOARD", sub: eventCount + " evt · " + levels.length + " lv", tone: "green" };
    const links = [
      { from: "core", to: "mt5", active: activeMt5 }, { from: "core", to: "csv", active: csvLive }, { from: "core", to: "px", active: !!price },
      ...feedNodes.map(n => ({ from: "mt5", to: n.id, active: n.active })),
      ...levelNodes.map(n => ({ from: "csv", to: n.id, active: true })),
      { from: "mt5", to: "dash", active: activeMt5 }, { from: "csv", to: "dash", active: csvLive }, { from: "px", to: "dash", active: !!price },
    ];
    const nodes = [root, ...sources, ...feedNodes, ...levelNodes, sink];
    return { nodes, links, byId: Object.fromEntries(nodes.map(n => [n.id, n])) };
  }, [feeds, levels, eventCount, csvLive, price]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let t = 0;
    let width = 0, height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const parent = canvas.parentElement; if (!parent) return;
      width = parent.clientWidth; height = parent.clientHeight;
      canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px"; canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); window.addEventListener("resize", resize);
    const tones: Record<string, string> = {
      cyan: "57,255,232", green: "125,255,106", amber: "255,209,102", muted: "120,140,150",
    };
    const draw = () => {
      t += 0.008;
      ctx.clearRect(0, 0, width, height);
      const sx = width / 320, sy = height / 200;
      // A faint living circuit grid gives the tree depth without competing with labels.
      ctx.save();
      ctx.strokeStyle = "rgba(100,180,200,.055)"; ctx.lineWidth = 1;
      for (let x = 12; x < width; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 12; y < height; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      ctx.restore();

      for (let index = 0; index < graph.links.length; index++) {
        const l = graph.links[index], a = graph.byId[l.from], b = graph.byId[l.to];
        if (!a || !b) continue;
        const x1 = a.x * sx, y1 = (a.y + 5) * sy, x2 = b.x * sx, y2 = (b.y - 5) * sy;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + (l.from === "core" ? 5 : 0);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.strokeStyle = l.active ? "rgba(80,235,220,.36)" : "rgba(100,140,160,.15)";
        ctx.lineWidth = l.active ? 1.3 : 0.8; ctx.stroke();
        if (!l.active) continue;

        // Packets travel out, ease to a stop before the destination, then return.
        // The cosine cycle is continuous at both ends: no visible jump/reset.
        const phase = (t * 0.22 + index * 0.173) % 1;
        const u = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
        const travel = 0.84 * u + 0.08; // always turns around before either endpoint
        const inv = 1 - travel;
        const px = inv * inv * x1 + 2 * inv * travel * mx + travel * travel * x2;
        const py = inv * inv * y1 + 2 * inv * travel * my + travel * travel * y2;
        const alpha = 0.55 + 0.35 * Math.sin(t * 2.4 + index);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 9);
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`); grad.addColorStop(1, "rgba(57,255,232,0)");
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(180,255,248,${alpha})`; ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
      }

      // A heartbeat travels through the core, but the pulse stays contained in the node.
      const beat = Math.pow(Math.max(0, Math.sin(t * 2.4)), 8);
      for (const n of graph.nodes) {
        const x = n.x * sx, y = n.y * sy, rgb = tones[n.tone] || tones.cyan;
        const base = n.id === "core" ? 5.3 : 3.8;
        const pulse = n.id === "core" ? 1 + beat * 0.28 : 1 + 0.08 * Math.sin(t * 2 + n.x * 0.04);
        if (n.id === "core") {
          ctx.beginPath(); ctx.arc(x, y, base + 4 + beat * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${rgb},${0.08 + beat * 0.2})`; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.beginPath(); ctx.fillStyle = `rgba(${rgb},${n.tone === "muted" ? .48 : .96})`;
        ctx.shadowColor = `rgba(${rgb},.8)`; ctx.shadowBlur = n.tone === "muted" ? 0 : 9 + beat * 5;
        ctx.arc(x, y, base * pulse, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.textAlign = "center"; ctx.fillStyle = "rgba(240,255,248,.96)";
        ctx.font = "600 10px 'IBM Plex Mono', monospace"; ctx.fillText(n.label, x, y + 15);
        ctx.fillStyle = "rgba(140,170,180,.92)"; ctx.font = "8px 'IBM Plex Mono', monospace"; ctx.fillText(n.sub, x, y + 25);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [graph]);

  const activeLinks = graph.links.filter(l => l.active).length;
  return <div className="treeWrap">
    <div className="treeHead"><div><b>DATA FLOW TREE</b><small>LIVE CIRCUITS · PULSE STREAM</small></div><span className="neuralBadge">{activeLinks} ACTIVE</span></div>
    <div className="treeBody"><canvas ref={canvasRef} className="treeCanvas" /></div>
  </div>;
}
