"use client";

import { useMemo } from "react";

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
  const graph = useMemo(() => {
    // Layout coordinates in viewBox 0 0 320 200
    const root = { id: "core", x: 160, y: 18, label: "GC CORE", sub: csvLive || eventCount ? "LIVE" : "STANDBY", tone: "cyan" as const };

    const midY = 70;
    const sources = [
      { id: "mt5", x: 55, y: midY, label: "MT5 BRIDGE", sub: feeds.some((f) => f.active) ? "UP" : "IDLE", tone: feeds.some((f) => f.active) ? ("green" as const) : ("muted" as const) },
      { id: "csv", x: 160, y: midY, label: "BARCHART", sub: csvLive ? "LOADED" : "OFF", tone: csvLive ? ("green" as const) : ("muted" as const) },
      { id: "px", x: 265, y: midY, label: "SPOT", sub: price ? price.toFixed(2) : "—", tone: price ? ("cyan" as const) : ("muted" as const) },
    ];

    const feedY = 120;
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
      y: 155,
      label: String(l.strike),
      sub: String(l.score),
      tone: "cyan" as const,
      active: true,
    }));

    const sink = {
      id: "dash",
      x: 160,
      y: 185,
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

  return (
    <div className="treeWrap">
      <div className="treeHead">
        <div>
          <b>DATA FLOW TREE</b>
          <small>REAL SOURCES · LIVE ROUTING</small>
        </div>
        <span className="neuralBadge">{graph.links.filter((l) => l.active).length} ACTIVE</span>
      </div>
      <div className="treeBody">
        <svg className="treeSvg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet">
          {graph.links.map((l, i) => {
            const a = graph.byId[l.from];
            const b = graph.byId[l.to];
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2 + (l.from === "core" ? 8 : 0);
            return (
              <path
                key={i}
                className={"treeLink" + (l.active ? " active" : "")}
                d={`M ${a.x} ${a.y + 8} Q ${mx} ${my} ${b.x} ${b.y - 8}`}
              />
            );
          })}
          {graph.nodes.map((n) => (
            <g key={n.id}>
              <circle
                className={"treeDot " + n.tone}
                cx={n.x}
                cy={n.y}
                r={n.id === "core" ? 5.5 : 4}
                opacity={n.tone === "muted" ? 0.45 : 1}
              >
                {n.tone !== "muted" && (
                  <animate attributeName="r" values={n.id === "core" ? "5.5;7;5.5" : "4;5;4"} dur="2.4s" repeatCount="indefinite" />
                )}
              </circle>
              <text className="treeNodeLabel" x={n.x} y={n.y + 16} textAnchor="middle">
                {n.label}
              </text>
              <text className="treeNodeSub" x={n.x} y={n.y + 25} textAnchor="middle">
                {n.sub}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
