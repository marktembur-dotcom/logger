"use client";

import { useEffect, useMemo, useState } from "react";
import BarchartCsvImport from "./components/BarchartCsvImport";
import NeuralShell from "./components/NeuralShell";
import DataFlowTree from "./components/DataFlowTree";
import DetailDrawer from "./components/DetailDrawer";

type Row = { symbol: string; type: string; strike: number; bid: number; ask: number; last: number; volume: number; openInterest: number; iv: number; ivSkew?: number; delta: number; gamma: number; theta: number; vega: number; dte: number; expiration: string; tradeTime: string; percentFromLast: number; baseLast: number; };
type Level = { strike: number; score: number; gamma: number; delta: number; callIv: number; putIv: number; callSkew: number; putSkew: number; dte: number; oi: number; volume: number; distance: number; side: "CALL" | "PUT"; label: string; };
type QualifiedZone = { strike: number; side: "BUY" | "SELL"; rulesPassed: number; matchedRules: string[]; delta: number; iv: number; gamma: number; theta: number; vega: number; ivSkew: number; distance: number; };
type Mt5Event = { id: string; source: "WIN" | "XAU5" | "XAU1"; tier: "early" | "partial" | "confirmed" | "watch"; signal: string; symbol: string; tf: string; price: number; score?: number; confidence?: string; side?: "buy" | "sell"; entry?: number; sl?: number; tp?: number; zoneHigh?: number; zoneLow?: number; reason?: string; seq?: string; measuredProb?: number; time: string; receivedAt: string; };

const empty = { live: false, rows: [] as Row[], error: "" };
const THEMES = ["neon", "cyan", "emerald", "violet", "amber", "ice"] as const;
type ThemeName = (typeof THEMES)[number] | "custom";

function scoreRow(c: Row, p: Row, price: number): Level {
  const dte = Math.max(c.dte || p.dte, 0); const distance = c.strike - price; const gamma = Math.max(c.gamma, p.gamma);
  const atm = Math.max(0, 1 - Math.abs(Math.abs(c.delta) - 0.5) * 2); const skew = p.iv - c.iv;
  const activity = Math.log10(1 + Math.max(c.openInterest, p.openInterest) + Math.max(c.volume, p.volume) * 2);
  const dist = Math.max(0, 1 - Math.abs(distance) / 30); const g = Math.min(1, gamma / (Math.max(c.gamma, p.gamma) || 1));
  const dteScore = dte <= 2 ? 1 : dte <= 3 ? 0.75 : dte <= 7 ? 0.35 : 0;
  const raw = 30 * g + 20 * atm + 15 * Math.min(1, Math.max(0, skew / 5)) + 15 * dteScore + 10 * Math.min(1, activity / 5) + 10 * dist;
  return { strike: c.strike, score: Math.round(raw), gamma, delta: Math.abs(c.delta), callIv: c.iv, putIv: p.iv, callSkew: c.ivSkew ?? 0, putSkew: p.ivSkew ?? 0, dte, oi: Math.max(c.openInterest, p.openInterest), volume: Math.max(c.volume, p.volume), distance, side: skew >= 0 ? "PUT" : "CALL", label: gamma === c.gamma ? "Gamma Reaction" : "Gamma Zone" };
}
function quantile(values: number[], q: number) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return Number.NaN;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
function fmt(n: number, d = 1) { return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d }); }
function tierTag(t?: string) { if (t === "confirmed") return "tag confirmed"; if (t === "partial") return "tag partial"; if (t === "early") return "tag early"; return "tag watch"; }
function ago(iso?: string) { if (!iso) return "—"; const ms = Date.now() - new Date(iso).getTime(); if (ms < 0) return "0s"; if (ms < 60000) return Math.floor(ms / 1000) + "s"; if (ms < 3600000) return Math.floor(ms / 60000) + "m"; return Math.floor(ms / 3600000) + "h"; }
function FeedMini({ title, feed }: { title: string; feed?: Mt5Event }) {
  const tone = title === "WIN" ? "feedMini-win" : title === "XAU 5M" ? "feedMini-xau5" : "feedMini-xau1";
  return (<div className={"feedMini " + tone + (feed ? " on" : "")}><div className="fh"><b>{title}</b><span className={tierTag(feed?.tier)}>{feed?.tier?.toUpperCase() || "IDLE"}</span></div>{feed ? (<><div className={"sig " + (feed.side === "buy" ? "sigBuy" : feed.side === "sell" ? "sigSell" : "")}>{feed.signal}</div><div className="meta"><span>PX<b>{fmt(feed.price, 2)}</b></span><span>TF<b>{feed.tf || "—"}</b></span><span>T<b>{ago(feed.receivedAt || feed.time)}</b></span></div></>) : (<div className="idle">Waiting for MT5…</div>)}</div>);
}
const defaultCustom = { c1: "#39ffb6", c2: "#7dff6a", c3: "#5ec8ff", c4: "#ffe566", c5: "#ff4d9a", c6: "#c77dff" };

export default function Home() {
  const [data, setData] = useState<any>(empty);
  const [mt5, setMt5] = useState<{ live: boolean; feeds: Partial<Record<string, Mt5Event>>; events: Mt5Event[] }>({ live: false, feeds: {}, events: [] });
  const [now, setNow] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("neon");
  const [custom, setCustom] = useState(defaultCustom);

  useEffect(() => { try { const t = localStorage.getItem("gc-theme") as ThemeName | null; const c = localStorage.getItem("gc-custom"); if (t) setTheme(t); if (c) setCustom({ ...defaultCustom, ...JSON.parse(c) }); } catch {} }, []);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); if (theme === "custom") { const root = document.documentElement.style; root.setProperty("--custom-c1", custom.c1); root.setProperty("--custom-c2", custom.c2); root.setProperty("--custom-c3", custom.c3); root.setProperty("--custom-c4", custom.c4); root.setProperty("--custom-c5", custom.c5); root.setProperty("--custom-c6", custom.c6); } try { localStorage.setItem("gc-theme", theme); localStorage.setItem("gc-custom", JSON.stringify(custom)); } catch {} }, [theme, custom]);
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const rows = detail.rows || [];
      if (rows.length) {
        setData({
          live: true,
          source: detail.source || "Barchart CSV Download",
          fetchedAt: detail.importedAt || new Date().toISOString(),
          rows,
          error: "",
        });
      }
    };
    window.addEventListener("barchart-csv", h);
    return () => window.removeEventListener("barchart-csv", h);
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function loadLatestImport() {
      try {
        const response = await fetch("/api/barchart/import", { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok || !result?.ok) throw new Error(result?.error || "Unable to load saved Barchart import");
        const latest = result.import;
        if (latest?.rows?.length) {
          setData({
            live: true,
            source: latest.sourceFile || "Barchart CSV Download",
            fetchedAt: latest.importedAt || "",
            rows: latest.rows,
            error: "",
          });
        }
      } catch (error) {
        if (!cancelled) setData((previous: any) => ({
          ...previous,
          error: error instanceof Error ? error.message : "Unable to load saved Barchart import",
        }));
      }
    }
    loadLatestImport();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    try { const cached = localStorage.getItem("gc-mt5-cache"); if (cached) { const parsed = JSON.parse(cached); if (parsed?.feeds || parsed?.events) setMt5({ live: !!parsed.live || Object.keys(parsed.feeds || {}).length > 0, feeds: parsed.feeds || {}, events: parsed.events || [] }); } } catch {}
    let stop = false;
    const pull = async () => {
      try {
        const r = await fetch("/api/mt5/state", { cache: "no-store" });
        const j = await r.json();
        if (stop || !j?.ok) return;
        const feeds = j.feeds || {}; const events = j.events || [];
        if (Object.keys(feeds).length > 0 || events.length > 0) {
          const next = { live: !!j.live || Object.keys(feeds).length > 0, feeds, events };
          setMt5(next);
          try { localStorage.setItem("gc-mt5-cache", JSON.stringify(next)); } catch {}
        }
      } catch {}
    };
    pull(); const id = setInterval(pull, 3000);
    return () => { stop = true; clearInterval(id); };
  }, []);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const rows: Row[] = data.rows || [];
  const mt5Price = mt5.feeds.XAU5?.price || mt5.feeds.XAU1?.price || mt5.feeds.WIN?.price || 0;
  const price = rows.find((x) => x.baseLast)?.baseLast || mt5Price || 0;
  const calls = rows.filter((x) => x.type.toLowerCase() === "call");
  const puts = rows.filter((x) => x.type.toLowerCase() === "put");
  const levels = useMemo(() => {
    const map = new Map<number, { c?: Row; p?: Row }>();
    for (const r of calls) { const x = map.get(r.strike) || {}; x.c = r; map.set(r.strike, x); }
    for (const r of puts) { const x = map.get(r.strike) || {}; x.p = r; map.set(r.strike, x); }
    return [...map.entries()].filter(([, x]) => x.c && x.p).map(([, x]) => scoreRow(x.c!, x.p!, price)).sort((a, b) => b.score - a.score);
  }, [rows, price]);
  const topLevels = levels.slice(0, 6);
  const zoneResults = useMemo(() => {
    if (!price || !rows.length) return { buy: [] as QualifiedZone[], sell: [] as QualifiedZone[], nearStrikes: [] as number[] };
    const pairs = new Map<number, { c?: Row; p?: Row }>();
    for (const row of rows) {
      const pair = pairs.get(row.strike) || {};
      if (row.type.toLowerCase() === "call") pair.c = row;
      if (row.type.toLowerCase() === "put") pair.p = row;
      pairs.set(row.strike, pair);
    }
    const nearby = [...pairs.entries()]
      .filter(([, pair]) => pair.c && pair.p)
      .map(([strike, pair]) => ({ strike, c: pair.c!, p: pair.p!, distance: strike - price }))
      .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance) || a.strike - b.strike)
      .slice(0, 10);

    function qualify(side: "BUY" | "SELL"): QualifiedZone[] {
      const candidates = nearby.map((item) => ({ ...item, row: side === "BUY" ? item.c : item.p }));
      const valid = candidates.filter((item) => Number.isFinite(item.row.iv) && item.row.iv > 0);
      if (!valid.length) return [];
      const lowIv = quantile(valid.map((item) => item.row.iv), 0.25);
      const lowVega = quantile(valid.map((item) => item.row.vega), 0.25);
      const highGamma = quantile(valid.map((item) => item.row.gamma), 0.75);
      const highAbsTheta = quantile(valid.map((item) => Math.abs(item.row.theta)), 0.75);
      const zones: QualifiedZone[] = [];
      for (const item of candidates) {
        const row = item.row;
        const matchedRules: string[] = [];
        if (Math.abs(row.delta) >= 0.5) matchedRules.push("Delta");
        if (row.iv > 0 && row.iv <= lowIv) matchedRules.push("Low IV");
        if (row.gamma >= highGamma) matchedRules.push("High Gamma");
        if (Math.abs(row.theta) >= highAbsTheta) matchedRules.push("More-negative Theta");
        if (row.vega <= lowVega) matchedRules.push("Low Vega");
        const skew = row.ivSkew;
        if (typeof skew === "number" && (side === "BUY" ? skew > 0 : skew < 0)) matchedRules.push("IV Skew");
        if (matchedRules.length >= 3) {
          zones.push({
            strike: item.strike,
            side,
            rulesPassed: matchedRules.length,
            matchedRules,
            delta: Math.abs(row.delta),
            iv: row.iv,
            gamma: row.gamma,
            theta: row.theta,
            vega: row.vega,
            ivSkew: typeof skew === "number" ? skew : 0,
            distance: item.distance,
          });
        }
      }
      return zones.sort((a, b) => b.rulesPassed - a.rulesPassed || Math.abs(a.distance) - Math.abs(b.distance) || a.strike - b.strike);
    }
    return { buy: qualify("BUY"), sell: qualify("SELL"), nearStrikes: nearby.map((item) => item.strike) };
  }, [rows, price]);
  const buyZones = zoneResults.buy;
  const sellZones = zoneResults.sell;
  const atm = levels.length ? levels.reduce((a, b) => (Math.abs(a.distance) < Math.abs(b.distance) ? a : b)) : null;
  const putSkew = atm ? atm.putSkew : 0;
  const maxGamma = Math.max(...topLevels.map((x) => x.gamma), 0.000001);
  const mt5Live = mt5.live || Object.keys(mt5.feeds).length > 0;
  const eventCount = mt5.events.length;
  const confirmedN = mt5.events.filter((e) => e.tier === "confirmed").length;
  const partialN = mt5.events.filter((e) => e.tier === "partial").length;
  const earlyN = mt5.events.filter((e) => e.tier === "early").length;
  const latest = mt5.events[0] || mt5.feeds.XAU5 || mt5.feeds.XAU1 || mt5.feeds.WIN || null;
  const lastLatency = latest ? Math.max(0, Date.now() - new Date(latest.receivedAt || latest.time).getTime()) : 0;
  const latLabel = lastLatency === 0 && !latest ? "—" : lastLatency < 1000 ? lastLatency + " MS" : lastLatency < 60000 ? (lastLatency / 1000).toFixed(1) + " S" : Math.floor(lastLatency / 60000) + " M";
  const spark = useMemo(() => { const base = topLevels.map((l) => l.score); if (base.length >= 12) return base.slice(0, 24); const out = [...base]; while (out.length < 24) out.push(Math.max(5, (out[out.length - 1] || 40) * 0.92 + 8)); return out; }, [topLevels]);
  const neuralNodes = useMemo(() => {
    const nodes: { label: string; value: string; tone?: "cyan" | "green" | "amber" | "red" | "muted" }[] = [];
    if (mt5.feeds.XAU5) nodes.push({ label: "XAU 5M", value: mt5.feeds.XAU5.tier.toUpperCase(), tone: mt5.feeds.XAU5.tier === "confirmed" ? "green" : mt5.feeds.XAU5.tier === "partial" ? "amber" : "cyan" });
    if (mt5.feeds.XAU1) nodes.push({ label: "XAU 1M", value: mt5.feeds.XAU1.tier.toUpperCase(), tone: mt5.feeds.XAU1.tier === "confirmed" ? "green" : mt5.feeds.XAU1.tier === "partial" ? "amber" : "cyan" });
    if (mt5.feeds.WIN) nodes.push({ label: "WIN", value: mt5.feeds.WIN.tier.toUpperCase(), tone: mt5.feeds.WIN.tier === "confirmed" ? "green" : "cyan" });
    if (price) nodes.push({ label: "XAU / GC", value: fmt(price, 2), tone: "green" });
    if (atm) nodes.push({ label: "ATM STRIKE", value: fmt(atm.strike, 0), tone: "cyan" });
    if (atm) nodes.push({ label: "PUT SKEW", value: fmt(putSkew, 2) + "%", tone: putSkew >= 0 ? "amber" : "cyan" });
    if (topLevels[0]) nodes.push({ label: "TOP GAMMA", value: fmt(topLevels[0].strike, 0), tone: "green" });
    if (latest) nodes.push({ label: "LAST SIGNAL", value: latest.source, tone: "cyan" });
    if (!nodes.length) { nodes.push({ label: "ENGINE", value: "STANDBY", tone: "muted" }); nodes.push({ label: "MT5", value: "IDLE", tone: "muted" }); nodes.push({ label: "BARCHART", value: data.live ? "ON" : "OFF", tone: data.live ? "green" : "muted" }); }
    return nodes;
  }, [mt5.feeds, price, atm, putSkew, topLevels, latest, data.live]);
  const treeFeeds = [
    { source: "WIN", tier: mt5.feeds.WIN?.tier, signal: mt5.feeds.WIN?.signal, price: mt5.feeds.WIN?.price, active: !!mt5.feeds.WIN },
    { source: "XAU5", tier: mt5.feeds.XAU5?.tier, signal: mt5.feeds.XAU5?.signal, price: mt5.feeds.XAU5?.price, active: !!mt5.feeds.XAU5 },
    { source: "XAU1", tier: mt5.feeds.XAU1?.tier, signal: mt5.feeds.XAU1?.signal, price: mt5.feeds.XAU1?.price, active: !!mt5.feeds.XAU1 },
  ];
  const utc = now.toISOString().slice(11, 19) + " UTC";
  const themeColors: Record<string, string> = { neon: "linear-gradient(135deg,#0a1814,#0a1520,#1a0a18)", cyan: "linear-gradient(135deg,#0a1520,#123040)", emerald: "linear-gradient(135deg,#0a1812,#0d2820)", violet: "linear-gradient(135deg,#120e1c,#1a1430)", amber: "linear-gradient(135deg,#18120a,#2a1c0c)", ice: "linear-gradient(135deg,#0a1420,#102030)" };

  return (
    <div className="cc">
      <header className="topStrip">
        <div className="brandBlock"><div className="brandMark">GC</div><div><div className="brandTitle">GC COMMAND CENTER</div><div className="brandSub">GOLD · ZONES · OPTIONS · MT5 LIVE</div></div></div>
        <div className="chipRow">
          <span className={"chip " + (mt5Live ? "green" : "red")}><span className={"liveDot " + (mt5Live ? "" : "off")} style={{ marginRight: 4 }} />{mt5Live ? "MT5 LIVE" : "MT5 IDLE"}</span>
          <span className={"chip " + (data.live ? "on" : "")}>{data.live ? "BARCHART ON" : "CSV OFF"}</span>
          <span className="chip on">ZONE ENGINE</span><span className="chip">EARLY / PARTIAL / CONFIRMED</span><span className="chip amber">XAUUSD FOCUS</span>
        </div>
        <div className="topMeta"><span>XAU</span><b>{price ? fmt(price, 2) : "—"}</b><span>{utc}</span>
          <a className="goldLabLaunch" href="/gold-lab">OPEN GOLD LAB ↗</a>
          <button className="iconBtn" type="button" onClick={() => setDetailOpen(true)}>DATA</button>
          <button className="iconBtn" type="button" onClick={() => setSettingsOpen(true)}>THEME</button>
        </div>
      </header>
      <BarchartCsvImport />
      <div className="mainGrid">
        <section className="panel engineCard accent-green"><div className="panelHead"><div><b>SIGNAL ENGINE</b><small>LIVE FEED</small></div><span className={"chip " + (mt5Live ? "green" : "")}>{mt5Live ? "LIVE" : "IDLE"}</span></div><div className="panelBody"><div className={"enginePnl " + (eventCount ? "" : "idle")}>{eventCount ? eventCount + " EVENTS" : "NO EVENTS"}</div><div className="statGrid"><div><span>CONFIRMED</span><b style={{ color: "var(--c2)" }}>{confirmedN}</b></div><div><span>PARTIAL</span><b style={{ color: "var(--c4)" }}>{partialN}</b></div><div><span>EARLY</span><b style={{ color: "var(--c1)" }}>{earlyN}</b></div><div><span>FEEDS</span><b>{Object.keys(mt5.feeds).length}/3</b></div><div><span>LATENCY</span><b>{latLabel}</b></div><div><span>LEVELS</span><b>{levels.length}</b></div></div></div></section>
        <section className="panel spotPanel accent-cyan"><div className="panelHead"><div><b>XAU / GC SPOT</b><small>{data.live ? "BARCHART" : mt5Price ? "MT5" : "AWAITING"}</small></div><span className={"chip " + (price ? "green" : "")}>{price ? "LIVE" : "—"}</span></div><div className="panelBody"><div className="bigPrice">{price ? fmt(price, 2) : "—"}</div><div className="statGrid"><div><span>ATM IV</span><b>{atm ? fmt((atm.callIv + atm.putIv) / 2, 2) + "%" : "—"}</b></div><div><span>PUT SKEW</span><b style={{ color: putSkew >= 0 ? "var(--c4)" : "var(--c1)" }}>{atm ? fmt(putSkew, 2) : "—"}</b></div></div><div className="barStage spotBarStage" aria-label="XAU GC spot gamma activity bars and reflection"><div className="miniBars spotBars">{topLevels.length ? topLevels.map((l, i) => (<i key={l.strike} style={{ height: Math.max(18, (l.gamma / maxGamma) * 100) + "%", animationDelay: `${(i % 6) * -0.19}s`, animationDuration: `${0.9 + (i % 4) * 0.16}s` }} />)) : Array.from({ length: 10 }).map((_, i) => (<i key={i} style={{ height: 6 + (i % 4) * 8 + "%", opacity: 0.25 }} />))}</div><div className="miniBars barReflection spotBars" aria-hidden="true">{topLevels.length ? topLevels.map((l, i) => (<i key={l.strike} style={{ height: Math.max(18, (l.gamma / maxGamma) * 100) + "%", animationDelay: `${(i % 6) * -0.19}s`, animationDuration: `${0.9 + (i % 4) * 0.16}s` }} />)) : Array.from({ length: 10 }).map((_, i) => (<i key={i} style={{ height: 6 + (i % 4) * 8 + "%", opacity: 0.25 }} />))}</div></div></div></section>
        <section className="panel latPanel accent-blue"><div className="panelHead"><div><b>FEED LATENCY</b><small>SIGNAL AGE · 3S POLL</small></div></div><div className="panelBody"><div className="latBig">{latLabel}</div><div className="statGrid"><div><span>BRIDGE</span><b style={{ color: mt5Live ? "var(--c2)" : "var(--c5)" }}>{mt5Live ? "UP" : "DOWN"}</b></div><div><span>CSV</span><b>{data.live ? "LOADED" : "OFF"}</b></div></div><div className="barStage latencyBarStage" aria-label="Animated feed latency bars and reflection"><div className="spark">{spark.map((v, i) => (<i key={i} style={{ height: Math.max(8, (v / 100) * 100) + "%", animationDelay: `${(i % 12) * -0.11}s`, animationDuration: `${0.72 + (i % 5) * 0.13}s` }} />))}</div><div className="spark barReflection" aria-hidden="true">{spark.map((v, i) => (<i key={i} style={{ height: Math.max(8, (v / 100) * 100) + "%", animationDelay: `${(i % 12) * -0.11}s`, animationDuration: `${0.72 + (i % 5) * 0.13}s` }} />))}</div></div></div></section>
        <section className="panel leadPanel accent-amber"><div className="panelHead"><div><b>BUY ZONES</b><small>6 RULES · NEAREST 10 STRIKES</small></div><span className="chip green">{buyZones.length} QUALIFIED</span></div><div className="panelBody scroll" style={{ padding: "2px 6px" }}>{buyZones.length ? buyZones.map((z, i) => (<div className="leadRow" key={z.strike}><span className="leadRank">{String(i + 1).padStart(2, "0")}</span><span className="leadStrike">{fmt(z.strike, 0)} <small style={{ color: "var(--muted)" }}>{z.matchedRules.join(" · ")}</small></span><span className="leadScore">{z.rulesPassed}/6</span></div>)) : (<div className="empty">No BUY zones qualify — import current Barchart data</div>)}</div></section>
        <section className="panel wirePanel accent-pink"><div className="panelHead"><div><b>WIRE INSPECTOR</b><small>MT5 INGEST</small></div></div><div className="panelBody scroll">{mt5.events.length ? mt5.events.slice(0, 40).map((e) => (<div className="wireLine" key={e.id}><span className="ts">{new Date(e.receivedAt || e.time).toLocaleTimeString()}</span>{" "}<span className="src">{e.source}</span>{" "}<span className={"tier-" + e.tier}>{e.tier}</span>{" "}<span className="ok">{fmt(e.price, 2)}</span> {e.signal.slice(0, 40)}</div>)) : (<div className="empty">No ingest yet</div>)}</div></section>
        <section className="panel neuralPanel accent-multi"><div className="centerSplit"><div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
                <NeuralShell
                  nodes={neuralNodes}
                  title="NEURAL FIELD · ZONE GRAPH"
                  subtitle="SIGNAL-DRIVEN · MT5 LIVE"
                  signals={mt5.events.slice(0, 20).map((e) => ({
                    id: e.id,
                    side: e.side,
                    tier: e.tier,
                    price: e.price,
                    source: e.source,
                    receivedAt: e.receivedAt || e.time,
                  }))}
                  latest={latest ? { id: latest.id, side: latest.side, tier: latest.tier, price: latest.price, source: latest.source, receivedAt: latest.receivedAt || latest.time } : null}
                  live={mt5Live}
                />
                <div className="feedStrip"><FeedMini title="WIN" feed={mt5.feeds.WIN} /><FeedMini title="XAU 5M" feed={mt5.feeds.XAU5} /><FeedMini title="XAU 1M" feed={mt5.feeds.XAU1} /></div></div><DataFlowTree feeds={treeFeeds} levels={topLevels.map((l) => ({ strike: l.strike, score: l.score, side: l.side }))} eventCount={eventCount} csvLive={!!data.live} price={price} /></div></section>
        <section className="panel leadPanel2 accent-violet"><div className="panelHead"><div><b>SELL ZONES</b><small>6 RULES · NEAREST 10 STRIKES</small></div><span className="chip">{sellZones.length} QUALIFIED</span></div><div className="panelBody scroll" style={{ padding: "2px 6px" }}>{sellZones.length ? sellZones.map((z, i) => (<div className="leadRow" key={z.strike}><span className="leadRank">{String(i + 1).padStart(2, "0")}</span><span className="leadStrike">{fmt(z.strike, 0)} <small style={{ color: "var(--muted)" }}>{z.matchedRules.join(" · ")}</small></span><span className="leadScore">{z.rulesPassed}/6</span></div>)) : (<div className="empty">No SELL zones qualify — import current Barchart data</div>)}</div></section>
        <section className="panel tapePanel accent-mint"><div className="panelHead"><div><b>EXECUTION TAPE · MT5</b><small>EARLY · PARTIAL · CONFIRMED</small></div><span className="chip on">{eventCount} ROWS</span></div><div className="panelBody scroll" style={{ padding: 0 }}>{mt5.events.length ? (<table className="tapeTable"><thead><tr><th>TIME</th><th>SRC</th><th>TIER</th><th>SIGNAL</th><th>PRICE</th><th>TF</th></tr></thead><tbody>{mt5.events.slice(0, 30).map((e) => (<tr key={e.id}><td>{new Date(e.receivedAt || e.time).toLocaleTimeString()}</td><td>{e.source}</td><td><span className={tierTag(e.tier)}>{e.tier}</span></td><td className={e.side === "buy" ? "sigBuy" : e.side === "sell" ? "sigSell" : ""}>{e.signal}</td><td>{fmt(e.price, 2)}</td><td>{e.tf || "—"}</td></tr>))}</tbody></table>) : (<div className="empty">Tape empty — waiting for MT5 signals</div>)}</div></section>
        <section className="panel funnelPanel accent-gold"><div className="panelHead"><div><b>RESOLUTION FUNNEL</b><small>EARLY → PARTIAL → CONFIRMED</small></div></div><div className="panelBody funnelBody"><div className="funnelSummary"><span>RESOLUTION PIPELINE</span><b>{earlyN + partialN + confirmedN}<small> SIGNAL EVENTS</small></b></div><div className="funnelFlow"><div className="funnelStep earlyStep"><div className="funnelStepHead"><span><i />EARLY</span><b>{earlyN}</b></div><div className="funnelTrack"><i style={{ width: Math.max(earlyN ? 8 : 0, (earlyN / Math.max(1, earlyN, partialN, confirmedN)) * 100) + "%" }} /></div><small>Initial detection</small></div><div className="funnelConnector"><span>↓</span></div><div className="funnelStep partialStep"><div className="funnelStepHead"><span><i />PARTIAL</span><b>{partialN}</b></div><div className="funnelTrack"><i style={{ width: Math.max(partialN ? 8 : 0, (partialN / Math.max(1, earlyN, partialN, confirmedN)) * 100) + "%" }} /></div><small>Developing signal</small></div><div className="funnelConnector"><span>↓</span></div><div className="funnelStep confirmedStep"><div className="funnelStepHead"><span><i />CONFIRMED</span><b>{confirmedN}</b></div><div className="funnelTrack"><i style={{ width: Math.max(confirmedN ? 8 : 0, (confirmedN / Math.max(1, earlyN, partialN, confirmedN)) * 100) + "%" }} /></div><small>Validated signal</small></div></div><div className="funnelFoot"><span>LIVE TIER COUNTS</span><span><i /> UPDATING FROM MT5</span></div></div></section>
      </div>

      <footer className="footStrip"><span>GC COMMAND CENTER · <b>{mt5Live ? "BRIDGE UP" : "BRIDGE IDLE"}</b></span><div className="footMetrics"><span>EVT<b>{eventCount}</b></span><span>FEEDS<b>{Object.keys(mt5.feeds).length}/3</b></span><span>LV<b>{levels.length}</b></span><span>LAT<b>{latLabel}</b></span><span>THEME<b>{theme.toUpperCase()}</b></span></div><span>{utc}</span></footer>

      {settingsOpen && (<div className="settingsOverlay" onClick={() => setSettingsOpen(false)}><div className="settingsPanel" onClick={(e) => e.stopPropagation()}><div className="settingsHead"><b>THEME SETTINGS</b><button className="iconBtn" type="button" onClick={() => setSettingsOpen(false)}>CLOSE</button></div><div className="settingsBody"><label>PRESETS</label><div className="themeGrid">{THEMES.map((t) => (<button key={t} type="button" className={"themeSwatch" + (theme === t ? " active" : "")} style={{ background: themeColors[t] }} onClick={() => setTheme(t)}>{t}</button>))}</div><label>CUSTOM BLEND</label><div className="colorRow">{(["c1", "c2", "c3", "c4", "c5", "c6"] as const).map((key) => (<div key={key}><span style={{ fontSize: 9, color: "var(--muted)" }}>{key.toUpperCase()}</span><input type="color" value={custom[key]} onChange={(e) => { setCustom((prev) => ({ ...prev, [key]: e.target.value })); setTheme("custom"); }} /></div>))}</div><div className="settingsActions"><button className="ghost" type="button" onClick={() => { setTheme("neon"); setCustom(defaultCustom); }}>RESET NEON</button><button className="primary" type="button" onClick={() => setSettingsOpen(false)}>APPLY</button></div></div></div></div>)}
      <DetailDrawer open={detailOpen} onClose={() => setDetailOpen(false)} levels={levels} price={price} rowsCount={rows.length} rows={rows} buyZones={buyZones} sellZones={sellZones} />
    </div>
  );
}
