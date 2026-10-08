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

    const R = 118;
    const r = 48;
    const segsU = 90;
    const segsV = 36;

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
      const f = 420 / (420 + z);
      return { x: w / 2 + x * f, y: h / 2 + y * f * 0.92, s: f };
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      t += 0.008;
      ctx.clearRect(0, 0, w, h);

      // soft glow background
      const g = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h) * 0.45);
      g.addColorStop(0, "rgba(40,120,140,0.12)");
      g.addColorStop(0.5, "rgba(20,60,90,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const rotY = t * 0.55;
      const rotX = 0.55 + Math.sin(t * 0.3) * 0.08;

      // spokes from center outward
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + t * 0.2;
        const len = 160 + Math.sin(t + k) * 30;
        const x1 = Math.cos(a) * 20;
        const y1 = Math.sin(a) * 12;
        const x2 = Math.cos(a) * len;
        const y2 = Math.sin(a) * len * 0.55;
        ctx.beginPath();
        ctx.moveTo(w / 2 + x1, h / 2 + y1);
        ctx.lineTo(w / 2 + x2, h / 2 + y2);
        ctx.strokeStyle = `rgba(98,230,225,${0.04 + (k % 3) * 0.02})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // torus particles
      for (const p of points) {
        const uu = p.u + rotY;
        const vv = p.v + t * 0.35;
        let x = (R + r * Math.cos(vv)) * Math.cos(uu);
        let y = (R + r * Math.cos(vv)) * Math.sin(uu);
        let z = r * Math.sin(vv);

        // rotate X
        const y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
        const z2 = y * Math.sin(rotX) + z * Math.cos(rotX);
        y = y2;
        z = z2;

        const pr = project(x, y, z + 40, w, h);
        const pulse = 0.45 + 0.55 * Math.sin(t * 2 + p.phase);
        const depth = Math.max(0.15, Math.min(1, pr.s));
        const size = 1.1 + depth * 1.8 * pulse;

        const hue = z > 0 ? "98,230,225" : "94,180,230";
        ctx.beginPath();
        ctx.fillStyle = `rgba(${hue},${0.25 + depth * 0.55})`;
        ctx.arc(pr.x, pr.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // inner ring
      ctx.beginPath();
      ctx.strokeStyle = "rgba(98,230,225,0.18)";
      ctx.lineWidth = 1.5;
      ctx.ellipse(w / 2, h / 2, 52, 22, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.ellipse(w / 2, h / 2, 140, 58, 0, 0, Math.PI * 2);
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
