"use client";

import { useRef, useState } from "react";

type ImportedRow = {
  symbol: string; type: string; strike: number; bid: number; ask: number; last: number;
  volume: number; openInterest: number; iv: number; delta: number; gamma: number; theta: number; vega: number;
  dte: number; expiration: string; tradeTime: string; percentFromLast: number; baseLast: number;
};

function n(v: string) {
  const x = Number(String(v ?? "").replace(/[%,$,]/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}
function clean(v: string) {
  return String(v ?? "").replace(/^"|"$/g, "").trim();
}

function parseCsv(text: string): ImportedRow[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((x) => x.trim());
  if (!lines.length) return [];
  const rows: string[][] = [];
  for (const line of lines) {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (ch === "," && !q) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    rows.push(out);
  }

  const header = rows[0].map(clean);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const idx = (name: string) => header.findIndex((h) => norm(h) === norm(name));
  const findAny = (names: string[]) => {
    for (const name of names) {
      const i = idx(name);
      if (i >= 0) return i;
    }
    return -1;
  };

  const strike = findAny(["Strike", "Strike Price"]);
  const typeCol = findAny(["Type", "Option Type"]);
  if (strike < 0 || typeCol < 0)
    throw new Error("This is not a Barchart Volatility & Greeks CSV: Strike/Type columns not found.");

  const latest = findAny(["Latest", "Last", "Last Price"]);
  const iv = findAny(["IV", "Implied Volatility", "Volatility"]);
  const delta = findAny(["Delta"]);
  const gamma = findAny(["Gamma"]);
  const theta = findAny(["Theta"]);
  const vega = findAny(["Vega"]);
  const time = findAny(["Last Trade", "Trade Time", "Time"]);

  function make(r: string[]): ImportedRow | null {
    const type = clean(r[typeCol]).toLowerCase();
    if (type !== "call" && type !== "put") return null;
    const strikeV = n(r[strike]);
    if (!strikeV) return null;
    const expiration = "10/09/2026";
    const dte = Math.max(
      0,
      Math.ceil((new Date("2026-10-09T23:59:59").getTime() - Date.now()) / 86400000)
    );
    return {
      symbol: "GCZ26",
      type,
      strike: strikeV,
      bid: 0,
      ask: 0,
      last: n(latest >= 0 ? r[latest] : ""),
      volume: 0,
      openInterest: 0,
      iv: n(iv >= 0 ? r[iv] : ""),
      delta: n(delta >= 0 ? r[delta] : ""),
      gamma: n(gamma >= 0 ? r[gamma] : ""),
      theta: n(theta >= 0 ? r[theta] : ""),
      vega: n(vega >= 0 ? r[vega] : ""),
      dte,
      expiration,
      tradeTime: clean(time >= 0 ? r[time] : ""),
      percentFromLast: 0,
      baseLast: 0,
    };
  }

  const out: ImportedRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const x = make(rows[i]);
    if (x) out.push(x);
  }
  if (!out.length) throw new Error("Barchart CSV was read, but no Call/Put rows were found.");

  const calls = out.filter((x) => x.type === "call").sort((a, b) => a.strike - b.strike);
  let baseLast = 0;
  for (let i = 0; i < calls.length - 1; i++) {
    const a = calls[i],
      b = calls[i + 1];
    if ((a.delta >= 0.5 && b.delta <= 0.5) || (a.delta <= 0.5 && b.delta >= 0.5)) {
      const denom = b.delta - a.delta;
      baseLast = denom ? a.strike + ((0.5 - a.delta) / denom) * (b.strike - a.strike) : a.strike;
      break;
    }
  }
  if (!baseLast && calls.length)
    baseLast = calls.reduce((a, b) => (Math.abs(a.delta - 0.5) < Math.abs(b.delta - 0.5) ? a : b)).strike;

  return out.map((x) => ({
    ...x,
    baseLast,
    percentFromLast: baseLast ? ((x.strike - baseLast) / baseLast) * 100 : 0,
  }));
}

export default function BarchartCsvImport() {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  function open() {
    window.open(
      "https://www.barchart.com/futures/quotes/GCZ26/volatility-greeks/IY6V26?futuresOptionsView=split",
      "_blank",
      "noopener,noreferrer"
    );
  }
  function choose() {
    input.current?.click();
  }
  function read(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ""));
        window.dispatchEvent(new CustomEvent("barchart-csv", { detail: { rows, source: file.name } }));
        setMsg(rows.length + " rows imported");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not read CSV");
      }
    };
    reader.readAsText(file);
  }
  return (
    <div className="importBar">
      <div>
        <b>BARCHART CSV</b>
        <small>Download from Barchart → import here for gamma levels & skew</small>
      </div>
      <div className="actions">
        <button className="ghost" onClick={open}>
          Open Barchart
        </button>
        <button className="primary" onClick={choose}>
          Import CSV
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) read(file);
            e.currentTarget.value = "";
          }}
        />
        {msg && <span className="importMsg">{msg}</span>}
      </div>
    </div>
  );
}
