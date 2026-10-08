"use client";

import { useEffect, useRef } from "react";

type NodeLink = { label: string; value: string; tone?: "cyan" | "green" | "amber" | "red" | "muted" };

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

    // Smaller torus so it fits without clipping
    const R = 90;
    const r = 36;
    const segsU = 80;
    const segsV = 32;

    const points: { u: number; v: number; phase: number }[] = [];
    for (let i = 0; i < segsU; i++) {
      for (let j = 0; j < segsV; j++) {
        if ((i + j) % 2 === 0) continue;
        points.push({
          u: (i / segsU) * Math.PI * 2,
          v: (j / segsV) * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    const project = (x: number, y: number, z: number, w: number, h: number) => {
      const f = 380 / (380 + z);
      return { x: w / 2 + x * f, y: h / 2 + y * f * 0.9, s: f };
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      t += 0.008;
      ctx.clearRect(0, 0, w, h);

      const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.42);
      g.addColorStop(0, "rgba(57,255,182,0.1)");
      g.addColorStop(0.5, "rgba(20,80,100,0.04)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const rotY = t * 0.55;
      const rotX = 0.5 + Math.sin(t * 0.3) * 0.08;

      // scale torus to fit height
      const fit = Math.min(w, h) / 280;

      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + t * 0.2;
        const len = (120 + Math.sin(t + k) * 20) * fit;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(a) * 12, h / 2 + Math.sin(a) * 8);
        ctx.lineTo(w / 2 + Math.cos(a) * len, h / 2 + Math.sin(a) * len * 0.5);
        ctx.strokeStyle = `rgba(57,255,182,${0.03 + (k % 3) * 0.015})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const p of points) {
        const uu = p.u + rotY;
        const vv = p.v + t * 0.35;
        let x = (R + r * Math.cos(vv)) * Math.cos(uu) * fit;
        let y = (R + r * Math.cos(vv)) * Math.sin(uu) * fit;
        let z = r * Math.sin(vv) * fit;

        const y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
        const z2 = y * Math.sin(rotX) + z * Math.cos(rotX);
        y = y2;
        z = z2;

        const pr = project(x, y, z + 30, w, h);
        const pulse = 0.45 + 0.55 * Math.sin(t * 2 + p.phase);
        const depth = Math.max(0.15, Math.min(1, pr.s));
        const size = 1 + depth * 1.6 * pulse;

        ctx.beginPath();
        ctx.fillStyle = z > 0 ? `rgba(57,255,182,${0.25 + depth * 0.55})` : `rgba(94,180,230,${0.2 + depth * 0.45})`;
        ctx.arc(pr.x, pr.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.strokeStyle = "rgba(57,255,182,0.2)";
      ctx.lineWidth = 1.5;
      ctx.ellipse(w / 2, h / 2, 40 * fit, 16 * fit, 0, 0, Math.PI * 2);
      ctx.stroke();

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
        <span className="neuralBadge">LIVE GRAPH</span>
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
