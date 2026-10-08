"use client";

import { useEffect, useMemo, useRef } from "react";

type Feed = {
  source: string;
  tier?: string;
  signal?: string;
  price?: number;
  active: boolean;
};

type Level = { strike: number; score: number; side: string };

export default function DataFlowTree({
  feeds,
  levels,
  eventCount,
  csvLive,
  price,
}: {
  feeds: Feed[];
  levels: Level[];
  eventCount: number;
  csvLive: boolean;
  price: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const graph = useMemo(() => {
    const root = { id: "core", x: 160, y: 22, label: "GC CORE", sub: csvLive || eventCount ? "LIVE" : "STANDBY", tone: "cyan" as const };
    const midY = 72;
    const sources = [
      { id: "mt5", x: 55, y: midY, label: "MT5 BRIDGE", sub: feeds.some((f) => f.active) ? "UP" : "IDLE", tone: feeds.some((f) => f.active) ? ("green" as const) : ("muted" as const) },
      { id: "csv", x: 160, y: midY, label: "BARCHART", sub: csvLive ? "LOADED" : "OFF", tone: csvLive ? ("green" as const) : ("muted" as const) },
      { id: "px", x: 265, y: midY, label: "SPOT", sub: price ? price.toFixed(2) : "—", tone: price ? ("cyan" as const) : ("muted" as const) },
    ];
    const feedY = 118;
    const feedNodes = feeds.map((f, i) => {
      const xs = [40, 100, 160];
      const tone =
        f.tier === "confirmed"
          ? ("green" as const)
          : f.tier === "partial"
            ? ("amber" as const)
            : f.active
              ? ("cyan" as const)
              : ("muted" as const);
      return {
        id: f.source,
        x: xs[i] ?? 40 + i * 60,
        y: feedY,
        label: f.source,
        sub: f.active ? (f.tier || "ON").toUpperCase() : "IDLE",
        tone,
        active: f.active,
      };
    });
    const levelNodes = levels.slice(0, 3).map((l, i) => ({
      id: "L" + l.strike,
      x: 220 + i * 35,
      y: 152,
      label: String(l.strike),
      sub: String(l.score),
      tone: "cyan" as const,
      active: true,
    }));
    const sink = {
      id: "dash",
      x: 160,
      y: 182,
      label: "DASHBOARD",
      sub: eventCount + " evt · " + levels.length + " lv",
      tone: "green" as const,
    };
    const links: { from: string; to: string; active: boolean }[] = [
      { from: "core", to: "mt5", active: feeds.some((f) => f.active) },
      { from: "core", to: "csv", active: csvLive },
      { from: "core", to: "px", active: !!price },
      ...feedNodes.map((n) => ({ from: "mt5", to: n.id, active: n.active })),
      ...levelNodes.map((n) => ({ from: "csv", to: n.id, active: true })),
      { from: "mt5", to: "dash", active: feeds.some((f) => f.active) },
      { from: "csv", to: "dash", active: csvLive },
      { from: "px", to: "dash", active: !!price },
    ];
    const nodes = [root, ...sources, ...feedNodes, ...levelNodes, sink];
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    return { nodes, links, byId };
  }, [feeds, levels, eventCount, csvLive, price]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const color = (tone: string, a = 1) => {
      const map: Record<string, string> = {
        cyan: `rgba(57,255,182,${a})`,
        green: `rgba(125,255,106,${a})`,
        amber: `rgba(255,229,102,${a})`,
        muted: `rgba(120,140,150,${a})`,
      };
      return map[tone] || map.cyan;
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      // scale viewBox 320x200 to canvas
      const sx = w / 320;
      const sy = h / 200;

      // links
      for (const l of graph.links) {
        const a = graph.byId[l.from];
        const b = graph.byId[l.to];
        if (!a || !b) continue;
        const x1 = a.x * sx;
        const y1 = (a.y + 8) * sy;
        const x2 = b.x * sx;
        const y2 = (b.y - 8) * sy;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 + (l.from === "core" ? 6 : 0);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.strokeStyle = l.active ? "rgba(57,255,182,0.55)" : "rgba(100,140,160,0.2)";
        ctx.lineWidth = l.active ? 1.6 : 1;
        ctx.stroke();

        // moving packets on active links
        if (l.active) {
          for (let p = 0; p < 2; p++) {
            const u = (t * 0.35 + p * 0.5) % 1;
            const inv = 1 - u;
            const px = inv * inv * x1 + 2 * inv * u * mx + u * u * x2;
            const py = inv * inv * y1 + 2 * inv * u * my + u * u * y2;
            ctx.beginPath();
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.shadowColor = "rgba(57,255,182,0.9)";
            ctx.shadowBlur = 8;
            ctx.arc(px, py, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // nodes
      for (const n of graph.nodes) {
        const x = n.x * sx;
        const y = n.y * sy;
        const pulse = 1 + 0.15 * Math.sin(t * 2.2 + n.x * 0.05);
        const r = (n.id === "core" ? 6 : 4.5) * pulse;

        ctx.beginPath();
        ctx.fillStyle = color(n.tone, n.tone === "muted" ? 0.4 : 0.95);
        ctx.shadowColor = color(n.tone, 0.6);
        ctx.shadowBlur = n.tone === "muted" ? 0 : 10;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(240,255,248,0.95)";
        ctx.font = "600 10px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(n.label, x, y + 16);
        ctx.fillStyle = "rgba(140,160,170,0.9)";
        ctx.font = "8px 'IBM Plex Mono', monospace";
        ctx.fillText(n.sub, x, y + 26);
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [graph]);

  const activeLinks = graph.links.filter((l) => l.active).length;

  return (
    <div className="treeWrap">
      <div className="treeHead">
        <div>
          <b>DATA FLOW TREE</b>
          <small>REAL SOURCES · LIVE PACKETS</small>
        </div>
        <span className="neuralBadge">{activeLinks} ACTIVE</span>
      </div>
      <div className="treeBody">
        <canvas ref={canvasRef} className="treeCanvas" />
      </div>
    </div>
  );
}
