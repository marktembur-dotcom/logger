"use client";

import { useEffect, useRef } from "react";

type NodeLink = { label: string; value: string; tone?: "cyan" | "green" | "amber" | "red" | "muted" };

/** Rectangular particle field — fills the panel (no round donut / wasted corners). */
export default function NeuralShell({
  nodes = [],
  title = "NEURAL SHELL",
  subtitle = "MODEL INPUTS · ZONE GRAPH",
}: {
  nodes?: NodeLink[];
  title?: string;
  subtitle?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
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

    type P = { x: number; y: number; z: number; phase: number; speed: number };
    const pts: P[] = [];
    const cols = 28;
    const rows = 14;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        pts.push({
          x: (i / (cols - 1)) * 2 - 1,
          y: (j / (rows - 1)) * 2 - 1,
          z: Math.random() * 2 - 1,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.8,
        });
      }
    }

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      t += 0.012;
      ctx.clearRect(0, 0, w, h);

      // soft rectangular glow
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "rgba(57,255,182,0.06)");
      g.addColorStop(0.5, "rgba(94,200,255,0.04)");
      g.addColorStop(1, "rgba(255,77,154,0.05)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const padX = w * 0.06;
      const padY = h * 0.1;
      const bw = w - padX * 2;
      const bh = h - padY * 2;

      // grid lines
      ctx.strokeStyle = "rgba(57,255,182,0.06)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        const x = padX + (bw * i) / 8;
        ctx.beginPath();
        ctx.moveTo(x, padY);
        ctx.lineTo(x, padY + bh);
        ctx.stroke();
      }
      for (let j = 0; j <= 4; j++) {
        const y = padY + (bh * j) / 4;
        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.lineTo(padX + bw, y);
        ctx.stroke();
      }

      // border frame
      ctx.strokeStyle = "rgba(57,255,182,0.2)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(padX, padY, bw, bh);

      // particles + links in rectangular field
      const projected: { x: number; y: number; a: number; s: number }[] = [];
      for (const p of pts) {
        const wave = Math.sin(t * p.speed + p.phase + p.x * 2) * 0.12;
        const wave2 = Math.cos(t * p.speed * 0.7 + p.y * 3) * 0.08;
        const px = padX + ((p.x + 1) / 2) * bw;
        const py = padY + ((p.y + 1) / 2) * bh + wave * bh * 0.15;
        const depth = 0.35 + 0.65 * ((p.z + 1) / 2 + wave2);
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + p.phase);
        projected.push({ x: px, y: py, a: depth * pulse, s: 1.2 + depth * 2.2 * pulse });
      }

      // light connections between near neighbors
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        for (let j = i + 1; j < Math.min(i + 6, projected.length); j++) {
          const b = projected[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < 48) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(57,255,182,${0.04 + (1 - d / 48) * 0.08})`;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of projected) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(57,255,182,${0.2 + p.a * 0.55})`;
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }

      // scanning bar
      const scanX = padX + ((t * 40) % bw);
      ctx.fillStyle = "rgba(57,255,182,0.04)";
      ctx.fillRect(scanX - 12, padY, 24, bh);

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="neuralWrap">
      <div className="neuralHead">
        <div>
          <b>{title}</b>
          <small>{subtitle}</small>
        </div>
        <span className="neuralBadge">LIVE FIELD</span>
      </div>
      <div className="neuralStage">
        <canvas ref={ref} />
        <div className="neuralNodes">
          {nodes.slice(0, 8).map((n, i) => (
            <div key={i} className={`neuralNode ${n.tone || "muted"}`}>
              <span>{n.label}</span>
              <b>{n.value}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
