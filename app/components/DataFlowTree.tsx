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
        { label: "MT5 SIGNALS", value: active ? "CONNECTED" : "WAITING", color: "#5ef5cf" },
        { label: "BARCHART DATA", value: csvLive ? "IMPORT READY" : "NO IMPORT", color: "#ffc66d" },
        { label: "GOLD SPOT", value: price ? price.toFixed(2) : "PRICE WAITING", color: "#80aaff" },
      ],
      activeCount: feeds.filter(f => f.active).length + (csvLive ? 1 : 0) + (price ? 1 : 0),
    };
  }, [feeds, csvLive, price]);

  const sourceTone = (i: number) => ["mint", "amber", "blue"][i % 3];
  const feedTone = (feed: Feed, i: number) => feed.tier?.toLowerCase() === "confirmed" ? "mint" : feed.tier?.toLowerCase() === "partial" ? "amber" : ["blue", "violet", "mint", "amber"][i % 4];
  const levelTone = (level: Level, i: number) => level.side?.toLowerCase() === "sell" ? "rose" : ["mint", "blue", "amber", "violet"][i % 4];

  return (
    <section className="treeWrap">
      <header className="treeHead">
        <div className="heading">
          <span className="eyebrow"><i /> SYSTEM TOPOLOGY / LIVE</span>
          <b>DATA FLOW TREE</b>
          <small>Cross-source signal routing</small>
        </div>
        <div className="liveCount"><span />{model.activeCount} LIVE</div>
      </header>

      <div className="treeCanvas">
        <div className="ambient ambientA" />
        <div className="ambient ambientB" />
        <svg className="flowWires" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="wireGradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#5ef5cf" />
              <stop offset="50%" stopColor="#80aaff" />
              <stop offset="100%" stopColor="#c49aff" />
            </linearGradient>
            <filter id="wireGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path className="wireBase" d="M500 55 V112 M500 112 C500 140 165 126 165 174 M500 112 V174 M500 112 C500 140 835 126 835 174 M165 224 C165 265 250 248 250 292 M500 224 V292 M835 224 C835 265 750 248 750 292 M250 346 C250 390 500 368 500 414 M500 346 V414 M750 346 C750 390 500 368 500 414" />
          <path className="wireEnergy" d="M500 55 V112 M500 112 C500 140 165 126 165 174 M500 112 V174 M500 112 C500 140 835 126 835 174 M165 224 C165 265 250 248 250 292 M500 224 V292 M835 224 C835 265 750 248 750 292 M250 346 C250 390 500 368 500 414 M500 346 V414 M750 346 C750 390 500 368 500 414" />
          <circle r="4" className="packet"><animateMotion dur="4.2s" repeatCount="indefinite" path="M500 55 V112 C500 140 165 126 165 174 V224 C165 265 250 248 250 292 V346 C250 390 500 368 500 414" /></circle>
          <circle r="3.5" className="packet packet2"><animateMotion dur="3.7s" begin="-1.2s" repeatCount="indefinite" path="M500 55 V112 C500 140 835 126 835 174 V224 C835 265 750 248 750 292 V346 C750 390 500 368 500 414" /></circle>
          <circle r="3" className="packet packet3"><animateMotion dur="2.9s" begin="-2s" repeatCount="indefinite" path="M500 55 V112 V174 V224 V292 V346 V414" /></circle>
        </svg>

        <div className="coreNode">
          <span className="coreIcon"><i /><i /><i /></span>
          <span><small>PROCESSING HUB</small><b>GC COMMAND CORE</b></span>
          <span className="coreState">ONLINE</span>
        </div>

        <div className="sourceGrid">
          {model.sources.map((item, i) => (
            <div className={`dataCard sourceCard ${sourceTone(i)}`} key={item.label}>
              <div className="cardTop"><span className="cardGlyph">{i === 0 ? "↗" : i === 1 ? "▤" : "◉"}</span><span className="statusPip" /></div>
              <span className="cardLabel">{item.label}</span>
              <b className="cardValue">{item.value}</b>
            </div>
          ))}
        </div>

        <div className="sectionLabel"><span>01</span> SIGNAL CHANNELS <i /> <small>{feeds.length} TOTAL</small></div>
        <div className="feedGrid">
          {feeds.length ? feeds.map((feed, i) => (
            <div className={`dataCard compactCard ${feedTone(feed, i)}`} key={`${feed.source}-${i}`}>
              <div className="compactHead"><span className="miniGlyph">⌁</span><span className={feed.active ? "stateTag active" : "stateTag"}>{feed.active ? "ACTIVE" : "IDLE"}</span></div>
              <span className="cardLabel" title={feed.source}>{feed.source || "SIGNAL FEED"}</span>
              <b className="cardValue">{(feed.tier || (feed.active ? "LIVE" : "STANDBY")).toUpperCase()}</b>
              {feed.signal ? <small className="extraValue" title={feed.signal}>{feed.signal}</small> : null}
              {typeof feed.price === "number" ? <small className="extraValue">{feed.price.toFixed(2)}</small> : null}
            </div>
          )) : <div className="emptyState">Awaiting MT5 signal channels…</div>}
        </div>

        <div className="sectionLabel levelLabel"><span>02</span> QUALIFIED ZONES <i /> <small>{levels.length} TOTAL</small></div>
        <div className="levelGrid">
          {levels.length ? levels.map((level, i) => (
            <div className={`dataCard zoneCard ${levelTone(level, i)}`} key={`${level.strike}-${level.side}-${i}`}>
              <div className="zoneHead"><span className="zoneSide">{(level.side || "ZONE").toUpperCase()}</span><span className="zoneIndex">{String(i + 1).padStart(2, "0")}</span></div>
              <b className="zoneStrike">{level.strike.toLocaleString()}</b>
              <div className="scoreTrack"><span style={{ width: `${Math.max(0, Math.min(100, Number(level.score) || 0))}%` }} /></div>
              <small className="zoneScore">MATCH SCORE <strong>{level.score}</strong></small>
            </div>
          )) : <div className="emptyState">No qualified zones yet — waiting for a fresh match.</div>}
        </div>

        <div className="treeFooter">
          <span className="footerMark"><i />GOLD LAB</span>
          <span>{eventCount} EVENTS <b>·</b> {levels.length} ZONES</span>
          <span className={csvLive ? "feedHealth healthy" : "feedHealth"}><i />{csvLive ? "BARCHART SYNCED" : "BARCHART OFFLINE"}</span>
        </div>
      </div>

      <style jsx>{`
        .treeWrap{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(105,167,202,.24);border-radius:15px;background:#06101e;color:#eaf5ff;font-family:'IBM Plex Mono',ui-monospace,monospace;box-shadow:0 14px 40px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.035)}
        .treeHead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 15px;border-bottom:1px solid rgba(120,175,210,.15);background:linear-gradient(105deg,rgba(17,37,59,.95),rgba(7,18,33,.96));flex:none}
        .heading{display:flex;flex-direction:column;gap:3px;min-width:0}.eyebrow{display:flex;align-items:center;gap:6px;color:#6d9bb4;font-size:8px;letter-spacing:1.25px}.eyebrow i,.liveCount span{width:6px;height:6px;border-radius:50%;background:#5ef5cf;box-shadow:0 0 9px #5ef5cf}.heading>b{font-size:12px;letter-spacing:1.3px;color:#f0f8ff}.heading small{font-size:9px;color:#7896ab}
        .liveCount{display:flex;align-items:center;gap:7px;white-space:nowrap;border:1px solid rgba(94,245,207,.25);border-radius:999px;padding:6px 9px;color:#8ef8dc;background:rgba(94,245,207,.06);font-size:8px;letter-spacing:.5px}
        .treeCanvas{position:relative;isolation:isolate;display:flex;flex-direction:column;gap:0;flex:1;min-height:0;overflow:hidden;padding:6px 8px 5px;background:radial-gradient(ellipse at 50% 15%,rgba(30,102,138,.19),transparent 52%),linear-gradient(180deg,#081729 0%,#050e1c 100%);scrollbar-width:thin;scrollbar-color:#2d5369 #081321}
        .treeCanvas::-webkit-scrollbar{width:5px}.treeCanvas::-webkit-scrollbar-thumb{background:#2d5369;border-radius:8px}
        .ambient{position:absolute;z-index:-1;width:180px;height:180px;border-radius:50%;filter:blur(55px);opacity:.13;pointer-events:none}.ambientA{background:#36e5c1;top:18%;left:-100px}.ambientB{background:#7c7bff;top:48%;right:-100px}
        .flowWires{position:absolute;z-index:0;inset:0;width:100%;height:100%;pointer-events:none;opacity:.9}.wireBase{fill:none;stroke:rgba(97,164,197,.17);stroke-width:1.5;vector-effect:non-scaling-stroke}.wireEnergy{fill:none;stroke:url(#wireGradient);stroke-width:1.5;stroke-linecap:round;stroke-dasharray:2 18;filter:url(#wireGlow);animation:wireDrift 2.8s linear infinite;vector-effect:non-scaling-stroke}.packet{fill:#5ef5cf;filter:url(#wireGlow)}.packet2{fill:#80aaff}.packet3{fill:#c49aff}
        .coreNode{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:7px;width:max-content;max-width:100%;flex:0 0 auto;margin:0 auto 6px;padding:5px 9px;border:1px solid rgba(94,245,207,.55);border-radius:10px;background:linear-gradient(135deg,rgba(10,39,53,.97),rgba(6,20,36,.98));box-shadow:0 0 0 1px rgba(94,245,207,.07),0 0 24px rgba(57,225,194,.12),inset 0 0 20px rgba(94,245,207,.055)}
        .coreIcon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;gap:2px;border:1px solid rgba(94,245,207,.32);border-radius:6px;background:rgba(94,245,207,.08)}.coreIcon i{width:3px;border-radius:2px;background:#5ef5cf;height:7px}.coreIcon i:nth-child(2){height:13px}.coreIcon i:nth-child(3){height:9px}.coreNode>span:nth-child(2){display:flex;flex-direction:column;gap:3px}.coreNode small{font-size:7px;letter-spacing:1.2px;color:#70b8b1}.coreNode b{font-size:10px;letter-spacing:.6px;color:#e6fff9}.coreState{font-size:7px;color:#5ef5cf;border-left:1px solid rgba(94,245,207,.22);padding-left:10px}
        .sourceGrid,.feedGrid,.levelGrid{position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;min-width:0}
        .dataCard{--tone:#80aaff;position:relative;min-width:0;overflow:hidden;border:1px solid color-mix(in srgb,var(--tone) 50%,rgba(92,132,163,.18));border-radius:9px;background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 8%,#0b1b2d),rgba(5,14,27,.98) 78%);box-shadow:inset 0 1px rgba(255,255,255,.025),0 5px 14px rgba(0,0,0,.12);padding:8px 9px;transition:border-color .2s,background .2s}
        .dataCard:before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:2px;border-radius:0 2px 2px 0;background:var(--tone);box-shadow:0 0 9px var(--tone);opacity:.85}.dataCard:after{content:"";position:absolute;top:0;right:0;width:34px;height:34px;background:radial-gradient(circle at top right,color-mix(in srgb,var(--tone) 13%,transparent),transparent 72%);pointer-events:none}
        .mint{--tone:#5ef5cf}.amber{--tone:#ffc66d}.blue{--tone:#80aaff}.violet{--tone:#c49aff}.rose{--tone:#ff86a5}
        .sourceCard{min-height:0;padding:5px 6px}.cardTop,.compactHead,.zoneHead{display:flex;align-items:center;justify-content:space-between;gap:6px}.cardGlyph{color:var(--tone);font-size:15px;line-height:1}.statusPip{width:5px;height:5px;border-radius:50%;background:var(--tone);box-shadow:0 0 8px var(--tone)}.cardLabel{display:block;min-width:0;overflow-wrap:anywhere;color:#8ca8bd;font-size:clamp(7px,.68vw,9px);line-height:1.35;letter-spacing:.35px;margin-top:5px}.cardValue{display:block;min-width:0;overflow-wrap:anywhere;color:var(--tone);font-size:clamp(8px,.78vw,10px);line-height:1.35;margin-top:4px;font-weight:700}
        .sectionLabel{position:relative;z-index:1;display:flex;align-items:center;gap:5px;flex:0 0 auto;margin:5px 1px 3px;color:#a9c3d6;font-size:8px;letter-spacing:1px}.sectionLabel>span{color:#5ef5cf;font-size:8px}.sectionLabel>i{height:1px;flex:1;background:linear-gradient(90deg,rgba(91,160,192,.3),transparent)}.sectionLabel small{font-size:7px;color:#6d8ca3;letter-spacing:.5px;white-space:nowrap}
        .feedGrid{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;flex:1 1 0;min-height:0;grid-auto-rows:minmax(0,1fr)}.compactCard{min-height:0;padding:4px 5px}.miniGlyph{color:var(--tone);font-size:13px;line-height:1}.stateTag{font-size:6px;letter-spacing:.5px;color:#9ab0c0;border:1px solid rgba(140,168,189,.18);border-radius:4px;padding:2px 4px}.stateTag.active{color:var(--tone);border-color:color-mix(in srgb,var(--tone) 35%,transparent);background:color-mix(in srgb,var(--tone) 7%,transparent)}.compactCard .cardLabel{font-size:clamp(6px,.6vw,8px);margin-top:6px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.compactCard .cardValue{font-size:clamp(7px,.65vw,9px);margin-top:3px}.extraValue{display:block;color:#7896ac;font-size:7px;margin-top:3px;overflow-wrap:anywhere}
        .levelLabel{margin-top:5px}.levelGrid{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;flex:2 1 0;min-height:0;grid-auto-rows:minmax(0,1fr)}.zoneCard{padding:4px 5px;min-height:0}.zoneSide{font-size:7px;letter-spacing:.8px;color:var(--tone)}.zoneIndex{font-size:7px;color:#4d6c82}.zoneStrike{display:block;margin-top:6px;color:#f1f7ff;font-size:clamp(11px,1vw,14px);line-height:1.1;letter-spacing:.3px}.scoreTrack{height:3px;background:rgba(140,172,194,.12);border-radius:4px;margin-top:7px;overflow:hidden}.scoreTrack span{display:block;height:100%;background:var(--tone);box-shadow:0 0 8px var(--tone);border-radius:4px}.zoneScore{display:flex;justify-content:space-between;gap:5px;margin-top:5px;color:#718ca2;font-size:6px;letter-spacing:.55px}.zoneScore strong{color:var(--tone);font-size:7px}.emptyState{grid-column:1/-1;border:1px dashed rgba(112,155,183,.25);border-radius:8px;padding:12px;text-align:center;color:#718ca2;font-size:8px}
        .treeFooter{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap;flex:0 0 auto;margin-top:4px;padding:5px 2px 0;border-top:1px solid rgba(120,175,210,.12);color:#718da4;font-size:7px;letter-spacing:.5px}.treeFooter b{color:#34566c;margin:0 3px}.footerMark{display:flex;align-items:center;gap:5px;color:#b8d8e4;font-weight:700}.footerMark i{width:5px;height:5px;border-radius:50%;background:#5ef5cf}.feedHealth{display:flex;align-items:center;gap:5px;color:#ffbd79}.feedHealth i{width:5px;height:5px;border-radius:50%;background:currentColor}.feedHealth.healthy{color:#5ef5cf}
        @keyframes wireDrift{to{stroke-dashoffset:-40}}
        @media(min-width:900px){.treeCanvas{padding:6px 8px 5px}.sourceGrid{gap:5px}.feedGrid,.levelGrid{gap:4px}.dataCard{padding-left:6px;padding-right:6px}}
        @media(max-width:560px){.treeHead{padding:10px 11px}.treeCanvas{padding:10px 8px 8px}.heading>b{font-size:11px}.heading small{font-size:8px}.sourceGrid{gap:5px}.sourceCard{padding:7px 6px;min-height:68px}.sourceCard .cardLabel{font-size:6.5px;letter-spacing:0}.sourceCard .cardValue{font-size:7.5px}.feedGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.compactCard{min-height:61px}.compactCard .cardLabel{font-size:8px}.compactCard .cardValue{font-size:8px}.levelGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.zoneCard{min-height:69px}.treeFooter{font-size:6.5px}}
        @media(prefers-reduced-motion:reduce){.wireEnergy{animation:none;stroke-dasharray:none;opacity:.45}.packet{display:none}.dataCard{transition:none}}
      `}</style>
    </section>
  );
}
