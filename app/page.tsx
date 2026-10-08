"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BarchartCsvImport from "./components/BarchartCsvImport";
import NeuralShell from "./components/NeuralShell";

type Row = {
  symbol: string; type: string; strike: number; bid: number; ask: number; last: number;
  volume: number; openInterest: number; iv: number; delta: number; gamma: number;
  theta: number; vega: number; dte: number; expiration: string; tradeTime: string;
  percentFromLast: number; baseLast: number;
};
type Level = {
  strike: number; score: number; gamma: number; delta: number; callIv: number; putIv: number;
  dte: number; oi: number; volume: number; distance: number; side: "CALL" | "PUT"; label: string;
};
type Mt5Event = {
  id: string; source: "WIN" | "XAU5" | "XAU1"; tier: "early" | "partial" | "confirmed" | "watch";
  signal: string; symbol: string; tf: string; price: number; score?: number; confidence?: string;
  side?: "buy" | "sell"; entry?: number; sl?: number; tp?: number; zoneHigh?: number; zoneLow?: number;
  reason?: string; seq?: string; measuredProb?: number; time: string; receivedAt: string;
};

const empty = { live: false, rows: [] as Row[], error: "" };

function scoreRow(c: Row, p: Row, price: number): Level {
  const dte = Math.max(c.dte || p.dte, 0);
  const distance = c.strike - price;
  const gamma = Math.max(c.gamma, p.gamma);
  const atm = Math.max(0, 1 - Math.abs(Math.abs(c.delta) - 0.5) * 2);
  const skew = p.iv - c.iv;
  const activity = Math.log10(1 + Math.max(c.openInterest, p.openInterest) + Math.max(c.volume, p.volume) * 2);
  const dist = Math.max(0, 1 - Math.abs(distance) / 30);
  const g = Math.min(1, gamma / (Math.max(c.gamma, p.gamma) || 1));
  const dteScore = dte <= 2 ? 1 : dte <= 3 ? 0.75 : dte <= 7 ? 0.35 : 0;
  const raw =
    30 * g +
    20 * atm +
    15 * Math.min(1, Math.max(0, skew / 5)) +
    15 * dteScore +
    10 * Math.min(1, activity / 5) +
    10 * dist;
  return {
    strike: c.strike,
    score: Math.round(raw),
    gamma,
    delta: Math.abs(c.delta),
    callIv: c.iv,
    putIv: p.iv,
    dte,
    oi: Math.max(c.openInterest, p.openInterest),
    volume: Math.max(c.volume, p.volume),
    distance,
    side: skew >= 0 ? "PUT" : "CALL",
    label: gamma === c.gamma ? "Gamma Reaction" : "Gamma Zone",
  };
}

function fmt(n: number, d = 1) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });
}
function tierTag(t?: string) {
  if (t === "confirmed") return "tag confirmed";
  if (t === "partial") return "tag partial";
  if (t === "early") return "tag early";
  return "tag watch";
}
function ago(iso?: string) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "0s";
  if (ms < 60000) return Math.floor(ms / 1000) + "s";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m";
  return Math.floor(ms / 3600000) + "h";
}

function FeedMini({ title, feed }: { title: string; feed?: Mt5Event }) {
  return (
    <div className={"feedMini " + (feed ? "on" : "")}>
      <div className="fh">
        <b>{title}</b>
        <span className={tierTag(feed?.tier)}>{feed?.tier?.toUpperCase() || "IDLE"}</span>
      </div>
      {feed ? (
        <>
          <div className={"sig " + (feed.side === "buy" ? "sigBuy" : feed.side === "sell" ? "sigSell" : "")}>
            {feed.signal}
          </div>
          <div className="meta">
            <span>PX<b>{fmt(feed.price, 2)}</b></span>
            <span>TF<b>{feed.tf || "—"}</b></span>
            <span>T<b>{ago(feed.receivedAt || feed.time)}</b></span>
          </div>
        </>
      ) : (
        <div className="idle">Waiting for MT5…</div>
      )}
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<any>(empty);
  const csvImportedRef = useRef(false);
  const [mt5, setMt5] = useState<{
    live: boolean;
    feeds: Partial<Record<string, Mt5Event>>;
    events: Mt5Event[];
    fetchedAt?: string;
  }>({ live: false, feeds: {}, events: [] });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const h = (e: any) => {
      const rows = e.detail?.rows || [];
      if (rows.length) {
        csvImportedRef.current = true;
        setData({
          live: true,
          source: "Barchart CSV Download",
          fetchedAt: new Date().toISOString(),
          rows,
          error: "",
        });
      }
    };
    window.addEventListener("barchart-csv", h);
    return () => window.removeEventListener("barchart-csv", h);
  }, []);

  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const r = await fetch("/api/mt5/state", { cache: "no-store" });
        const j = await r.json();
        if (!stop && j?.ok)
          setMt5({
            live: !!j.live,
            feeds: j.feeds || {},
            events: j.events || [],
            fetchedAt: j.fetchedAt,
          });
      } catch {}
    };
    pull();
    const id = setInterval(pull, 3000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const rows: Row[] = data.rows || [];
  const mt5Price =
    mt5.feeds.XAU5?.price ||
    mt5.feeds.XAU1?.price ||
    mt5.feeds.WIN?.price ||
    0;
  const price = rows.find((x) => x.baseLast)?.baseLast || mt5Price || 0;
  const calls = rows.filter((x) => x.type.toLowerCase() === "call");
  const puts = rows.filter((x) => x.type.toLowerCase() === "put");

  const levels = useMemo(() => {
    const map = new Map<number, { c?: Row; p?: Row }>();
    for (const r of calls) {
      const x = map.get(r.strike) || {};
      x.c = r;
      map.set(r.strike, x);
    }
    for (const r of puts) {
      const x = map.get(r.strike) || {};
      x.p = r;
      map.set(r.strike, x);
    }
    return [...map.entries()]
      .filter(([, x]) => x.c && x.p)
      .map(([, x]) => scoreRow(x.c!, x.p!, price))
      .sort((a, b) => b.score - a.score);
  }, [rows, price]);

  const topLevels = levels.slice(0, 6);
  const atm = levels.length
    ? levels.reduce((a, b) => (Math.abs(a.distance) < Math.abs(b.distance) ? a : b))
    : null;
  const putSkew = atm ? atm.putIv - atm.callIv : 0;
  const maxGamma = Math.max(...topLevels.map((x) => x.gamma), 0.000001);

  const mt5Live = mt5.live || Object.keys(mt5.feeds).length > 0;
  const eventCount = mt5.events.length;
  const confirmedN = mt5.events.filter((e) => e.tier === "confirmed").length;
  const partialN = mt5.events.filter((e) => e.tier === "partial").length;
  const earlyN = mt5.events.filter((e) => e.tier === "early").length;

  const latest =
    mt5.events[0] ||
    mt5.feeds.XAU5 ||
    mt5.feeds.XAU1 ||
    mt5.feeds.WIN ||
    null;

  const lastLatency = latest
    ? Math.max(0, Date.now() - new Date(latest.receivedAt || latest.time).getTime())
    : 0;
  const latLabel =
    lastLatency === 0 && !latest
      ? "—"
      : lastLatency < 1000
        ? lastLatency + " MS"
        : lastLatency < 60000
          ? (lastLatency / 1000).toFixed(1) + " S"
          : Math.floor(lastLatency / 60000) + " M";

  const spark = useMemo(() => {
    const base = topLevels.map((l) => l.score);
    if (base.length >= 12) return base.slice(0, 24);
    const out = [...base];
    while (out.length < 24) out.push(Math.max(5, (out[out.length - 1] || 40) + (Math.random() - 0.5) * 12));
    return out;
  }, [topLevels]);

  const neuralNodes = useMemo(() => {
    const nodes: { label: string; value: string; tone?: "cyan" | "green" | "amber" | "red" | "muted" }[] = [];
    if (mt5.feeds.XAU5)
      nodes.push({
        label: "XAU 5M",
        value: mt5.feeds.XAU5.tier.toUpperCase(),
        tone: mt5.feeds.XAU5.tier === "confirmed" ? "green" : mt5.feeds.XAU5.tier === "partial" ? "amber" : "cyan",
      });
    if (mt5.feeds.XAU1)
      nodes.push({
        label: "XAU 1M",
        value: mt5.feeds.XAU1.tier.toUpperCase(),
        tone: mt5.feeds.XAU1.tier === "confirmed" ? "green" : mt5.feeds.XAU1.tier === "partial" ? "amber" : "cyan",
      });
    if (mt5.feeds.WIN)
      nodes.push({
        label: "WIN",
        value: mt5.feeds.WIN.tier.toUpperCase(),
        tone: mt5.feeds.WIN.tier === "confirmed" ? "green" : "cyan",
      });
    if (price) nodes.push({ label: "XAU / GC", value: fmt(price, 2), tone: "green" });
    if (atm) nodes.push({ label: "ATM STRIKE", value: fmt(atm.strike, 0), tone: "cyan" });
    if (atm) nodes.push({ label: "PUT SKEW", value: fmt(putSkew, 2) + "%", tone: putSkew >= 0 ? "amber" : "cyan" });
    if (topLevels[0]) nodes.push({ label: "TOP GAMMA", value: fmt(topLevels[0].strike, 0), tone: "green" });
    if (latest) nodes.push({ label: "LAST SIGNAL", value: latest.source, tone: "cyan" });
    if (!nodes.length) {
      nodes.push({ label: "ENGINE", value: "STANDBY", tone: "muted" });
      nodes.push({ label: "MT5", value: "IDLE", tone: "muted" });
      nodes.push({ label: "BARCHART", value: data.live ? "ON" : "OFF", tone: data.live ? "green" : "muted" });
    }
    return nodes;
  }, [mt5.feeds, price, atm, putSkew, topLevels, latest, data.live]);

  const utc = now.toISOString().slice(11, 19) + " UTC";

  return (
    <div className="cc">
      {/* TOP STRIP */}
      <header className="topStrip">
        <div className="brandBlock">
          <div className="brandMark">GC</div>
          <div>
            <div className="brandTitle">GC COMMAND CENTER</div>
            <div className="brandSub">GOLD · ZONES · OPTIONS · MT5 LIVE</div>
          </div>
        </div>
        <div className="chipRow">
          <span className={"chip " + (mt5Live ? "green" : "")}>
            <span className={"liveDot " + (mt5Live ? "" : "off")} style={{ marginRight: 5 }} />
            {mt5Live ? "MT5 LIVE" : "MT5 IDLE"}
          </span>
          <span className={"chip " + (data.live ? "on" : "")}>{data.live ? "BARCHART ON" : "CSV OFF"}</span>
          <span className="chip on">ZONE ENGINE</span>
          <span className="chip">EARLY / PARTIAL / CONFIRMED</span>
          <span className="chip amber">XAUUSD FOCUS</span>
          {latest && <span className={"chip " + (latest.tier === "confirmed" ? "green" : "amber")}>LAST {latest.source} {latest.tier.toUpperCase()}</span>}
        </div>
        <div className="topMeta">
          <span>XAU</span>
          <b>{price ? fmt(price, 2) : "—"}</b>
          <span>{utc}</span>
        </div>
      </header>

      <BarchartCsvImport />

      <div className="mainGrid">
        {/* ENGINE CARD */}
        <section className="panel engineCard">
          <div className="panelHead">
            <div>
              <b>SIGNAL ENGINE</b>
              <small>LIVE FEED STATUS</small>
            </div>
            <span className={"chip " + (mt5Live ? "green" : "")}>{mt5Live ? "LIVE" : "IDLE"}</span>
          </div>
          <div className="panelBody">
            <div className={"enginePnl " + (eventCount ? "" : "idle")}>
              {eventCount ? eventCount + " EVENTS" : "NO EVENTS"}
            </div>
            <div className="statGrid">
              <div>
                <span>CONFIRMED</span>
                <b style={{ color: "var(--green)" }}>{confirmedN}</b>
              </div>
              <div>
                <span>PARTIAL</span>
                <b style={{ color: "var(--amber)" }}>{partialN}</b>
              </div>
              <div>
                <span>EARLY</span>
                <b style={{ color: "var(--cyan)" }}>{earlyN}</b>
              </div>
              <div>
                <span>ACTIVE FEEDS</span>
                <b>{Object.keys(mt5.feeds).length}/3</b>
              </div>
              <div>
                <span>WIN RATE</span>
                <b>—</b>
              </div>
              <div>
                <span>LAST LATENCY</span>
                <b>{latLabel}</b>
              </div>
            </div>
          </div>
        </section>

        {/* SPOT / GAMMA */}
        <section className="panel spotPanel">
          <div className="panelHead">
            <div>
              <b>XAU / GC SPOT</b>
              <small>{data.live ? "BARCHART UNDERLYING" : mt5Price ? "FROM MT5 SIGNAL" : "AWAITING DATA"}</small>
            </div>
            <span className={"chip " + (price ? "green" : "")}>{price ? "LIVE" : "—"}</span>
          </div>
          <div className="panelBody">
            <div className="bigPrice">{price ? fmt(price, 2) : "—"}</div>
            <div className="statGrid">
              <div>
                <span>ATM IV</span>
                <b>{atm ? fmt((atm.callIv + atm.putIv) / 2, 2) + "%" : "—"}</b>
              </div>
              <div>
                <span>PUT SKEW</span>
                <b style={{ color: putSkew >= 0 ? "var(--amber)" : "var(--cyan)" }}>
                  {atm ? fmt(putSkew, 2) : "—"}
                </b>
              </div>
            </div>
            <div className="miniBars">
              {topLevels.length
                ? topLevels.map((l) => (
                    <i key={l.strike} style={{ height: Math.max(8, (l.gamma / maxGamma) * 100) + "%" }} title={String(l.strike)} />
                  ))
                : Array.from({ length: 12 }).map((_, i) => (
                    <i key={i} style={{ height: 8 + (i % 5) * 10 + "%", opacity: 0.25 }} />
                  ))}
            </div>
          </div>
        </section>

        {/* LATENCY */}
        <section className="panel latPanel">
          <div className="panelHead">
            <div>
              <b>FEED LATENCY</b>
              <small>SIGNAL AGE · POLL 3S</small>
            </div>
          </div>
          <div className="panelBody">
            <div className="latBig">{latLabel}</div>
            <div className="statGrid">
              <div>
                <span>BRIDGE</span>
                <b style={{ color: mt5Live ? "var(--green)" : "var(--red)" }}>{mt5Live ? "UP" : "DOWN"}</b>
              </div>
              <div>
                <span>CSV</span>
                <b>{data.live ? "LOADED" : "OFF"}</b>
              </div>
            </div>
            <div className="spark">
              {spark.map((v, i) => (
                <i key={i} style={{ height: Math.max(4, (v / 100) * 100) + "%" }} />
              ))}
            </div>
          </div>
        </section>

        {/* LEADERS */}
        <section className="panel leadPanel">
          <div className="panelHead">
            <div>
              <b>LEVEL LEADERS</b>
              <small>GAMMA RANKED</small>
            </div>
          </div>
          <div className="panelBody" style={{ padding: "4px 8px" }}>
            {topLevels.length ? (
              topLevels.map((l, i) => (
                <div className="leadRow" key={l.strike}>
                  <span className="leadRank">{String(i + 1).padStart(2, "0")}</span>
                  <span className="leadStrike">
                    {fmt(l.strike, 0)} <small style={{ color: "var(--muted)" }}>{l.side}</small>
                  </span>
                  <span className="leadScore">{l.score}</span>
                </div>
              ))
            ) : (
              <div className="empty">Import Barchart CSV for ranked levels</div>
            )}
          </div>
        </section>

        {/* WIRE */}
        <section className="panel wirePanel">
          <div className="panelHead">
            <div>
              <b>WIRE INSPECTOR</b>
              <small>MT5 INGEST LOG</small>
            </div>
          </div>
          <div className="panelBody">
            {mt5.events.length ? (
              mt5.events.slice(0, 28).map((e) => (
                <div className="wireLine" key={e.id}>
                  <span className="ts">{new Date(e.receivedAt || e.time).toLocaleTimeString()}</span>{" "}
                  <span className="src">{e.source}</span>{" "}
                  <span className={"tier-" + e.tier}>{e.tier}</span>{" "}
                  <span className="ok">{fmt(e.price, 2)}</span>{" "}
                  {e.signal.slice(0, 48)}
                </div>
              ))
            ) : (
              <div className="empty">No ingest traffic yet. Bridge posts appear here live.</div>
            )}
          </div>
        </section>

        {/* NEURAL SHELL */}
        <section className="panel neuralPanel">
          <NeuralShell nodes={neuralNodes} title="NEURAL SHELL · ZONE GRAPH" subtitle="MT5 INPUTS · BARCHART LEVELS · LIVE MODEL VIEW" />
          <div className="feedStrip">
            <FeedMini title="WIN" feed={mt5.feeds.WIN} />
            <FeedMini title="XAU 5M" feed={mt5.feeds.XAU5} />
            <FeedMini title="XAU 1M" feed={mt5.feeds.XAU1} />
          </div>
        </section>

        {/* TAPE */}
        <section className="panel tapePanel">
          <div className="panelHead">
            <div>
              <b>EXECUTION TAPE · MT5 TIME & SALES</b>
              <small>EARLY · PARTIAL · CONFIRMED</small>
            </div>
            <span className="chip on">{eventCount} ROWS</span>
          </div>
          <div className="panelBody" style={{ padding: 0 }}>
            {mt5.events.length ? (
              <table className="tapeTable">
                <thead>
                  <tr>
                    <th>TIME</th>
                    <th>SRC</th>
                    <th>TIER</th>
                    <th>SIGNAL</th>
                    <th>PRICE</th>
                    <th>TF</th>
                    <th>SIDE</th>
                  </tr>
                </thead>
                <tbody>
                  {mt5.events.slice(0, 40).map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.receivedAt || e.time).toLocaleTimeString()}</td>
                      <td>{e.source}</td>
                      <td>
                        <span className={tierTag(e.tier)}>{e.tier}</span>
                      </td>
                      <td className={e.side === "buy" ? "sigBuy" : e.side === "sell" ? "sigSell" : ""}>
                        {e.signal}
                      </td>
                      <td>{fmt(e.price, 2)}</td>
                      <td>{e.tf || "—"}</td>
                      <td>{e.side || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">Tape empty — signals from WIN / XAU5 / XAU1 stream here.</div>
            )}
          </div>
        </section>

        {/* FUNNEL */}
        <section className="panel funnelPanel">
          <div className="panelHead">
            <div>
              <b>RESOLUTION FUNNEL</b>
              <small>EARLY → PARTIAL → CONFIRMED</small>
            </div>
          </div>
          <div className="panelBody">
            <div className="funnelViz">
              <svg className="funnelSvg" viewBox="0 0 320 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="fg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(78,240,226,0.5)" />
                    <stop offset="55%" stopColor="rgba(255,200,87,0.45)" />
                    <stop offset="100%" stopColor="rgba(93,255,159,0.55)" />
                  </linearGradient>
                </defs>
                <polygon points="10,15 200,35 200,85 10,105" fill="url(#fg)" opacity="0.25" />
                <polygon points="200,35 310,50 310,70 200,85" fill="rgba(93,255,159,0.2)" />
                <polyline
                  fill="none"
                  stroke="rgba(78,240,226,0.7)"
                  strokeWidth="1.5"
                  points={
                    "15," +
                    (90 - Math.min(70, earlyN * 8)) +
                    " 110," +
                    (80 - Math.min(50, partialN * 6)) +
                    " 220," +
                    (70 - Math.min(40, confirmedN * 5)) +
                    " 300,60"
                  }
                />
                <circle cx="15" cy={90 - Math.min(70, earlyN * 8)} r="3" fill="var(--cyan)" />
                <circle cx="110" cy={80 - Math.min(50, partialN * 6)} r="3" fill="var(--amber)" />
                <circle cx="220" cy={70 - Math.min(40, confirmedN * 5)} r="3" fill="var(--green)" />
                <circle cx="300" cy="60" r="3" fill="var(--green)" />
              </svg>
            </div>
            <div className="funnelStats">
              <div>
                <span>EARLY</span>
                <b style={{ color: "var(--cyan)" }}>{earlyN}</b>
              </div>
              <div>
                <span>PARTIAL</span>
                <b style={{ color: "var(--amber)" }}>{partialN}</b>
              </div>
              <div>
                <span>CONFIRMED</span>
                <b style={{ color: "var(--green)" }}>{confirmedN}</b>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* LEVELS DRAWER */}
      <details className="levelsDrawer">
        <summary>
          <span>BARCHART REACTION LEVELS · FULL TABLE</span>
          <span style={{ color: "var(--muted)" }}>{levels.length} ranked · {rows.length} option rows</span>
        </summary>
        <div className="levelsBody">
          <div className="lvRow head">
            <span>RANK</span>
            <span>STRIKE</span>
            <span>SCORE</span>
            <span>GAMMA</span>
            <span>SKEW</span>
            <span>DTE</span>
            <span>LABEL</span>
          </div>
          {levels.length ? (
            levels.slice(0, 24).map((l, i) => (
              <div className="lvRow" key={l.strike}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{fmt(l.strike, 0)}</b>
                <span style={{ color: "var(--green)" }}>{l.score}</span>
                <span>{l.gamma.toFixed(5)}</span>
                <span>{(l.putIv - l.callIv).toFixed(2)}%</span>
                <span>{l.dte}</span>
                <span>
                  {l.label} · {l.side}
                </span>
              </div>
            ))
          ) : (
            <div className="empty">No levels — import Barchart Volatility & Greeks CSV.</div>
          )}
        </div>
      </details>

      <footer className="footStrip">
        <span>
          GC COMMAND CENTER · <b>{mt5Live ? "MT5 BRIDGE UP" : "MT5 IDLE"}</b>
        </span>
        <div className="footMetrics">
          <span>
            EVENTS<b>{eventCount}</b>
          </span>
          <span>
            FEEDS<b>{Object.keys(mt5.feeds).length}/3</b>
          </span>
          <span>
            LEVELS<b>{levels.length}</b>
          </span>
          <span>
            LATENCY<b>{latLabel}</b>
          </span>
          <span>
            SOURCE<b>{data.live ? "BARCHART+MT5" : "MT5"}</b>
          </span>
        </div>
        <span>{utc}</span>
      </footer>
    </div>
  );
}
