"use client";

import { useEffect, useRef } from "react";

type NodeLink = { label: string; value: string; tone?: "cyan" | "green" | "amber" | "red" | "muted" };

type SignalPulse = {
  id: string;
  side?: "buy" | "sell";
  tier?: string;
  price?: number;
  source?: string;
  receivedAt?: string;
};

/**
 * Rectangular particle field driven by live MT5 signals.
 * - Energy scales with recent events / confirmed count
 * - Buy bias → left cyan/green swell; Sell → right pink/amber
 * - New notification → shockwave + particle surge
 * - Not decorative idle when signals are flowing
 */
export default function NeuralShell({
  nodes = [],
  title = "NEURAL FIELD",
  subtitle = "SIGNAL-DRIVEN",
  signals = [],
  latest,
  live = false,
}: {
  nodes?: NodeLink[];
  title?: string;
  subtitle?: string;
  signals?: SignalPulse[];
  latest?: SignalPulse | null;
  live?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    energy: 0.15,
    bias: 0, // -1 sell ... +1 buy
    shocks: [] as { x: number; y: number; t: number; r: number; side: number }[],
    lastId: "" as string,
    tierBoost: 0,
  });

  // Sync signal influence into animation state (no canvas restart)
  useEffect(() => {
    const s = stateRef.current;
    const recent = signals.slice(0, 12);
    const confirmed = recent.filter((e) => e.tier === "confirmed").length;
    const partial = recent.filter((e) => e.tier === "partial").length;
    const early = recent.filter((e) => e.tier === "early").length;

    // Energy: more + stronger tiers = denser, faster field
    const targetEnergy = Math.min(
      1,
      0.12 +
        recent.length * 0.06 +
        confirmed * 0.12 +
        partial * 0.06 +
        early * 0.03 +
        (live ? 0.08 : 0)
    );
    s.energy = s.energy * 0.6 + targetEnergy * 0.4;

    // Bias from latest sides in recent window
    let buy = 0,
      sell = 0;
    for (const e of recent) {
      if (e.side === "buy") buy++;
      if (e.side === "sell") sell++;
    }
    const total = buy + sell;
    const targetBias = total ? (buy - sell) / total : 0;
    s.bias = s.bias * 0.7 + targetBias * 0.3;

    // Tier flash
    if (latest?.tier === "confirmed") s.tierBoost = 1;
    else if (latest?.tier === "partial") s.tierBoost = 0.65;
    else if (latest?.tier === "early") s.tierBoost = 0.4;

    // New signal → shockwave
    if (latest?.id && latest.id !== s.lastId) {
      s.lastId = latest.id;
      const sideN = latest.side === "buy" ? 1 : latest.side === "sell" ? -1 : 0;
      // Map roughly across field: buy left, sell right, neutral center
      const x = sideN > 0 ? 0.28 : sideN < 0 ? 0.72 : 0.5;
      const y = 0.35 + Math.random() * 0.3;
      s.shocks.push({ x, y, t: 0, r: 0, side: sideN });
      if (s.shocks.length > 6) s.shocks.shift();
      s.energy = Math.min(1, s.energy + 0.35);
    }
  }, [signals, latest, live]);

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
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    type P = { x: number; y: number; z: number; phase: number; speed: number; seed: number };
    const pts: P[] = [];
    const cols = 30;
    const rows = 15;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        pts.push({
          x: (i / (cols - 1)) * 2 - 1,
          y: (j / (rows - 1)) * 2 - 1,
          z: Math.random() * 2 - 1,
          phase: Math.random() * Math.PI * 2,
          speed: 0.35 + Math.random() * 0.9,
          seed: Math.random(),
        });
      }
    }

    const rgba = (r: number, g: number, b: number, a: number) => `rgba(${r},${g},${b},${a})`;

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const st = stateRef.current;
      t += 0.01 + st.energy * 0.018;
      st.tierBoost *= 0.97;

      ctx.clearRect(0, 0, w, h);

      const energy = st.energy;
      const bias = st.bias; // -1 sell, +1 buy

      // Ambient wash shifts with bias
      const g = ctx.createLinearGradient(0, 0, w, h);
      const buyA = 0.04 + energy * 0.08 + Math.max(0, bias) * 0.06;
      const sellA = 0.03 + energy * 0.06 + Math.max(0, -bias) * 0.07;
      g.addColorStop(0, rgba(57, 255, 182, buyA));
      g.addColorStop(0.5, rgba(94, 200, 255, 0.03 + energy * 0.04));
      g.addColorStop(1, rgba(255, 77, 154, sellA));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const padX = w * 0.05;
      const padY = h * 0.08;
      const bw = w - padX * 2;
      const bh = h - padY * 2;

      // Grid intensity tracks energy
      ctx.strokeStyle = rgba(57, 255, 182, 0.04 + energy * 0.08);
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const x = padX + (bw * i) / 10;
        ctx.beginPath();
        ctx.moveTo(x, padY);
        ctx.lineTo(x, padY + bh);
        ctx.stroke();
      }
      for (let j = 0; j <= 5; j++) {
        const y = padY + (bh * j) / 5;
        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.lineTo(padX + bw, y);
        ctx.stroke();
      }

      // Border — color by bias, pulse by energy
      const borderPulse = 0.15 + energy * 0.35 + st.tierBoost * 0.3 + 0.1 * Math.sin(t * 3);
      if (bias > 0.2) ctx.strokeStyle = rgba(57, 255, 182, borderPulse);
      else if (bias < -0.2) ctx.strokeStyle = rgba(255, 77, 154, borderPulse);
      else ctx.strokeStyle = rgba(94, 200, 255, borderPulse);
      ctx.lineWidth = 1.5 + energy * 1.5;
      ctx.strokeRect(padX, padY, bw, bh);

      // Shockwaves from new notifications
      for (let i = st.shocks.length - 1; i >= 0; i--) {
        const sh = st.shocks[i];
        sh.t += 0.02;
        sh.r = sh.t * Math.max(bw, bh) * 0.55;
        const alpha = Math.max(0, 0.55 - sh.t * 0.55);
        if (alpha <= 0.02) {
          st.shocks.splice(i, 1);
          continue;
        }
        const cx = padX + sh.x * bw;
        const cy = padY + sh.y * bh;
        ctx.beginPath();
        if (sh.side > 0) ctx.strokeStyle = rgba(57, 255, 182, alpha);
        else if (sh.side < 0) ctx.strokeStyle = rgba(255, 77, 154, alpha);
        else ctx.strokeStyle = rgba(255, 229, 102, alpha);
        ctx.lineWidth = 2;
        ctx.arc(cx, cy, sh.r, 0, Math.PI * 2);
        ctx.stroke();
        // inner ring
        ctx.beginPath();
        ctx.strokeStyle = rgba(255, 255, 255, alpha * 0.4);
        ctx.lineWidth = 1;
        ctx.arc(cx, cy, sh.r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Particles influenced by bias + energy
      const projected: { x: number; y: number; a: number; s: number; tone: number }[] = [];
      for (const p of pts) {
        // Pull toward buy (left) or sell (right) zone
        const pull = bias * 0.12 * energy;
        const waveAmp = 0.06 + energy * 0.16;
        const wave = Math.sin(t * p.speed * (1 + energy) + p.phase + p.x * 2.2) * waveAmp;
        const surge = st.tierBoost * 0.08 * Math.sin(t * 6 + p.phase);

        let nx = p.x + pull + (p.seed - 0.5) * energy * 0.05;
        nx = Math.max(-1, Math.min(1, nx));
        const px = padX + ((nx + 1) / 2) * bw;
        const py = padY + ((p.y + 1) / 2) * bh + (wave + surge) * bh;

        const depth = 0.3 + 0.7 * ((p.z + 1) / 2);
        const pulse = 0.45 + 0.55 * Math.sin(t * (1.5 + energy * 2) + p.phase);
        const size = 1 + depth * (1.4 + energy * 2.2) * pulse + st.tierBoost * 1.2;

        // tone: 1 buy green, -1 sell pink, 0 neutral cyan
        let tone = bias * 0.7 + (p.x * 0.3);
        projected.push({ x: px, y: py, a: depth * pulse * (0.5 + energy), s: size, tone });
      }

      // Links denser when energy high
      const linkDist = 36 + energy * 28;
      const linkAlpha = 0.03 + energy * 0.1;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        for (let j = i + 1; j < Math.min(i + 5, projected.length); j++) {
          const b = projected[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < linkDist) {
            const midTone = (a.tone + b.tone) / 2;
            const al = linkAlpha * (1 - d / linkDist);
            if (midTone > 0.15) ctx.strokeStyle = rgba(57, 255, 182, al);
            else if (midTone < -0.15) ctx.strokeStyle = rgba(255, 77, 154, al);
            else ctx.strokeStyle = rgba(94, 200, 255, al);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of projected) {
        let col: string;
        if (p.tone > 0.2) col = rgba(57, 255, 182, 0.25 + p.a * 0.6);
        else if (p.tone < -0.2) col = rgba(255, 77, 154, 0.25 + p.a * 0.55);
        else col = rgba(94, 200, 255, 0.22 + p.a * 0.5);
        ctx.beginPath();
        ctx.fillStyle = col;
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }

      // Energy scan beam — faster when hot
      const scanSpeed = 28 + energy * 70;
      const scanX = padX + ((t * scanSpeed) % bw);
      ctx.fillStyle = rgba(57, 255, 182, 0.03 + energy * 0.05);
      ctx.fillRect(scanX - 10 - energy * 8, padY, 20 + energy * 16, bh);

      // Activity meter strip at bottom of field
      const meterH = 3;
      const meterW = bw * energy;
      ctx.fillStyle = rgba(20, 30, 40, 0.6);
      ctx.fillRect(padX, padY + bh - meterH - 2, bw, meterH);
      const mg = ctx.createLinearGradient(padX, 0, padX + bw, 0);
      mg.addColorStop(0, rgba(57, 255, 182, 0.9));
      mg.addColorStop(0.5, rgba(255, 229, 102, 0.85));
      mg.addColorStop(1, rgba(255, 77, 154, 0.9));
      ctx.fillStyle = mg;
      ctx.fillRect(padX, padY + bh - meterH - 2, meterW, meterH);

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const badge =
    latest?.tier === "confirmed"
      ? "CONFIRMED HIT"
      : latest?.tier === "partial"
        ? "PARTIAL"
        : latest?.tier === "early"
          ? "EARLY"
          : live
            ? "LIVE FIELD"
            : "STANDBY";

  return (
    <div className="neuralWrap">
      <div className="neuralHead">
        <div>
          <b>{title}</b>
          <small>{subtitle}</small>
        </div>
        <span className="neuralBadge">{badge}</span>
      </div>
      <div className="neuralStage">
        <canvas ref={canvasRef} />
      </div>
      <div className="neuralMetrics" aria-label="Live signal metrics">
        {nodes.slice(0, 8).map((n, i) => (
          <div key={i} className={`neuralNode ${n.tone || "muted"}`}>
            <span>{n.label}</span>
            <b>{n.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
