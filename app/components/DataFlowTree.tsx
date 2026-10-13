"use client";

import { useMemo } from "react";

type Feed = { source: string; tier?: string; signal?: string; price?: number; active: boolean };
type Level = { strike: number; score: number; side: string };

export default function DataFlowTree({ feeds, levels, eventCount, csvLive, price }: {
  feeds: Feed[]; levels: Level[]; eventCount: number; csvLive: boolean; price: number;
}) {
  const model = useMemo(() => {
    const active = feeds.some(f => f.active);
    return {
      sources: [
        { label: "MT5 SIGNALS", value: active ? "CONNECTED" : "WAITING", color: "#55f2c4" },
        { label: "BARCHART DATA", value: csvLive ? "IMPORT READY" : "NO IMPORT", color: "#ffc86b" },
        { label: "GOLD SPOT", value: price ? price.toFixed(2) : "PRICE WAITING", color: "#79aaff" },
      ],
      feeds: feeds.slice(0, 4).map(f => ({ label: f.source, value: f.active ? (f.tier || "ACTIVE").toUpperCase() : "IDLE", color: f.tier === "confirmed" ? "#55f2c4" : f.tier === "partial" ? "#ffc86b" : "#79aaff" })),
      levels: levels.slice(0, 4).map(l => ({ label: String(l.strike), value: (l.side || "ZONE").toUpperCase() + " · " + l.score, color: l.side?.toLowerCase() === "sell" ? "#ff7b9c" : "#55f2c4" })),
      activeCount: feeds.filter(f => f.active).length + (csvLive ? 1 : 0) + (price ? 1 : 0),
    };
  }, [feeds, levels, csvLive, price]);

  const connector = (d: string, color: string, delay = 0) => (
    <g key={d}>
      <path d={d} fill="none" stroke={color} strokeOpacity=".18" strokeWidth="2.8" />
      <path d={d} fill="none" stroke={color} strokeOpacity=".42" strokeWidth="3.8" strokeDasharray="1 30" strokeLinecap="round" filter="url(#flowEnergyGlow)">
        <animate attributeName="stroke-dashoffset" from="0" to="-62" dur="2.1s" begin={`${delay}s`} repeatCount="indefinite" />
      </path>
      <path d={d} fill="none" stroke={color} strokeOpacity=".98" strokeWidth="1.6" strokeDasharray="7 31" strokeLinecap="round">
        <animate attributeName="stroke-dashoffset" from="38" to="-38" dur="2.7s" begin={`${delay}s`} repeatCount="indefinite" />
      </path>
      <circle r="2.1" fill={color} filter="url(#flowEnergyGlow)">
        <animateMotion path={d} dur="3.4s" begin={`${delay}s`} repeatCount="indefinite" rotate="auto" />
      </circle>
    </g>
  );

  const card = (label: string, value: string, color: string, compact = false) => (
    <div className={compact ? "flowNode flowNode--small" : "flowNode"} key={label + value} style={{ "--node-color": color } as React.CSSProperties}>
      <span className="flowDot" />
      <span className="flowLabel">{label}</span>
      <b>{value}</b>
    </div>
  );

  return <section className="treeWrap treeWrap--organic treeWrap--flow">
    <header className="treeHead">
      <div><b>DATA FLOW TREE</b><small>LIVE DATA STREAM · CONTINUOUS CONFLUENCE</small></div>
      <span className="neuralBadge">{model.activeCount} LIVE</span>
    </header>
    <div className="treeBody flowBody">
      <div className="flowCore"><span className="coreRing" /><b>GC COMMAND CORE</b></div>
      <svg className="flowWires" viewBox="0 0 1000 360" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="flowEnergyGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="softGlow" />
            <feMerge><feMergeNode in="softGlow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {connector("M500 24 V62", "#75f5e2")}
        {connector("M500 62 C500 80 170 74 170 104", "#55f2c4", .2)}
        {connector("M500 62 V104", "#ffc86b", .55)}
        {connector("M500 62 C500 80 830 74 830 104", "#79aaff", .9)}
        {connector("M170 148 C170 175 125 172 125 202", "#55f2c4", .15)}
        {connector("M500 148 C500 175 375 172 375 202", "#ffc86b", .5)}
        {connector("M830 148 C830 175 625 172 625 202", "#79aaff", .85)}
        {connector("M170 148 C170 220 875 170 875 202", "#55f2c4", 1.1)}
        {connector("M125 240 V270 H500", "#55f2c4", .2)}
        {connector("M375 240 V270 H500", "#ffc86b", .55)}
        {connector("M625 240 V270 H500", "#79aaff", .9)}
        {connector("M875 240 V270 H500", "#55f2c4", 1.2)}
        {connector("M500 270 V310", "#75f5e2", .35)}
      </svg>
      <div className="flowSourceRow">{model.sources.map(s => card(s.label, s.value, s.color))}</div>
      <div className="flowFeedRow">{model.feeds.map(f => card(f.label, f.value, f.color, true))}</div>
      <div className="flowLevelRow">{model.levels.map(l => card(l.label, l.value, l.color, true))}</div>
      <div className="flowSink"><span />GOLD LAB <small>{eventCount} EVENTS / {levels.length} ZONES</small></div>
    </div>
    <style jsx>{`
      .treeWrap--flow{overflow:hidden}
      .flowBody{position:relative;min-height:300px;padding:0 12px 10px;overflow:hidden;background:radial-gradient(ellipse at 50% 38%,rgba(35,120,155,.14),transparent 58%),linear-gradient(180deg,rgba(5,17,34,.4),rgba(3,10,21,.96))}
      .flowCore{height:49px;display:flex;align-items:center;justify-content:center;gap:9px;position:relative;z-index:2;color:#eafffb;font:700 9px 'IBM Plex Mono',monospace;letter-spacing:.8px}
      .coreRing{width:9px;height:9px;border-radius:50%;background:#75f5e2;box-shadow:0 0 0 4px rgba(117,245,226,.10);flex:none}
      .flowWires{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
      .flowWires path{vector-effect:non-scaling-stroke}
      .flowWires circle{opacity:.95}
      @media(prefers-reduced-motion:reduce){.flowWires animate,.flowWires circle{display:none}}
      .flowSourceRow,.flowFeedRow,.flowLevelRow{position:absolute;left:12px;right:12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;z-index:1}
      .flowSourceRow{top:24%;}.flowFeedRow{top:51%;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
      .flowLevelRow{top:69%;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
      .flowNode{height:42px;min-width:0;border:1px solid color-mix(in srgb,var(--node-color) 78%,transparent);border-radius:9px;background:linear-gradient(135deg,rgba(8,25,43,.97),rgba(4,13,26,.97));display:flex;flex-direction:column;justify-content:center;padding:5px 8px;box-shadow:inset 0 0 14px color-mix(in srgb,var(--node-color) 8%,transparent)}
      .flowNode--small{height:34px;padding:4px 6px;border-radius:7px}
      .flowDot{width:5px;height:5px;border-radius:50%;background:var(--node-color);margin-bottom:3px;flex:none}
      .flowLabel{font:600 8px 'IBM Plex Mono',monospace;letter-spacing:.25px;color:#e8f7ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .flowNode b{font:7px 'IBM Plex Mono',monospace;color:var(--node-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
      .flowNode--small .flowLabel{font-size:7px}.flowNode--small b{font-size:7px}
      .flowSink{position:absolute;top:87%;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:7px;color:#dffffa;font:700 8px 'IBM Plex Mono',monospace;letter-spacing:.7px;z-index:1}
      .flowSink>span{width:5px;height:5px;border-radius:50%;background:#75f5e2}
      .flowSink small{font:7px 'IBM Plex Mono',monospace;color:#86aebc;letter-spacing:0}
      @media(max-width:500px){.flowBody{min-height:270px;padding-inline:7px}.flowSourceRow,.flowFeedRow,.flowLevelRow{left:7px;right:7px;gap:4px}.flowNode{padding:4px 5px}.flowLabel{font-size:7px}.flowNode--small .flowLabel{font-size:6px}.flowNode b,.flowNode--small b{font-size:6px}.flowSink{gap:4px}.flowSink small{font-size:6px}}
      .flowNode{border-color:color-mix(in srgb,var(--node-color) 92%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--node-color) 20%,transparent),0 0 12px color-mix(in srgb,var(--node-color) 24%,transparent),inset 0 0 16px color-mix(in srgb,var(--node-color) 11%,transparent)}
      .flowNode--small{box-shadow:0 0 0 1px color-mix(in srgb,var(--node-color) 18%,transparent),0 0 9px color-mix(in srgb,var(--node-color) 20%,transparent),inset 0 0 12px color-mix(in srgb,var(--node-color) 10%,transparent)}
      .flowSourceRow .flowNode,.flowFeedRow .flowNode,.flowLevelRow .flowNode{outline:1px solid color-mix(in srgb,var(--node-color) 35%,transparent);outline-offset:1px}
      .flowSourceRow .flowNode{height:42px;border-radius:9px;background:linear-gradient(135deg,rgba(8,25,43,.99),rgba(4,13,26,.99));box-shadow:0 0 0 1px color-mix(in srgb,var(--node-color) 22%,transparent),0 0 13px color-mix(in srgb,var(--node-color) 27%,transparent),inset 0 0 16px color-mix(in srgb,var(--node-color) 12%,transparent)}
      .flowFeedRow .flowNode,.flowLevelRow .flowNode{height:34px;border-radius:7px;background:linear-gradient(135deg,rgba(8,25,43,.99),rgba(4,13,26,.99));box-shadow:0 0 0 1px color-mix(in srgb,var(--node-color) 20%,transparent),0 0 10px color-mix(in srgb,var(--node-color) 23%,transparent),inset 0 0 12px color-mix(in srgb,var(--node-color) 10%,transparent)}
      .flowLabel,.flowNode b{position:relative;z-index:2}
      .flowCore{width:max-content;max-width:calc(100% - 28px);height:30px;margin:9px auto 0;padding:0 14px;border:1px solid rgba(117,245,226,.78);border-radius:8px;background:linear-gradient(135deg,rgba(7,34,48,.98),rgba(4,17,31,.98));box-shadow:0 0 0 1px rgba(117,245,226,.16),0 0 13px rgba(117,245,226,.22),inset 0 0 13px rgba(117,245,226,.09);white-space:nowrap}
      .flowSourceRow{top:23%}
      .flowFeedRow{top:49%}
      .flowLevelRow{top:68%}
      .flowSink{top:85%;left:50%;right:auto;transform:translateX(-50%);width:max-content;max-width:calc(100% - 24px);min-height:25px;padding:5px 11px;border:1px solid rgba(117,245,226,.7);border-radius:7px;background:linear-gradient(135deg,rgba(7,34,48,.98),rgba(4,17,31,.98));box-shadow:0 0 0 1px rgba(117,245,226,.14),0 0 11px rgba(117,245,226,.18),inset 0 0 12px rgba(117,245,226,.08);white-space:nowrap}
      .flowSink small{white-space:nowrap}
      @media(max-width:500px){.flowCore{height:27px;margin-top:7px;padding-inline:9px;font-size:8px}.flowSourceRow{top:23%}.flowFeedRow{top:49%}.flowLevelRow{top:68%}.flowSink{top:85%;gap:4px;padding:4px 6px;max-width:calc(100% - 10px)}.flowSink small{font-size:6px}}
      @media(prefers-reduced-motion:reduce){.flowWires animate{display:none}}
    `}</style>
  </section>;
}
