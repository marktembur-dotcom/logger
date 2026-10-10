"use client";

import { useEffect, useRef, useState } from "react";

type SavedImport = { id: string; sourceFile: string; rowCount: number; importedAt: string };

type ImportedRow = {
  symbol: string; type: string; strike: number; bid: number; ask: number; last: number;
  volume: number; openInterest: number; iv: number; ivSkew?: number; delta: number; gamma: number; theta: number; vega: number;
  dte: number; expiration: string; tradeTime: string; percentFromLast: number; baseLast: number;
};

function n(v: string) {
  const raw = String(v ?? "").replace(/[%,$,]/g, "").replace(/s$/i, "").trim();
  if (!raw || raw.toLowerCase() === "unch") return 0;
  const x = Number(raw);
  return Number.isFinite(x) ? x : 0;
}
function clean(v: string) {
  return String(v ?? "").replace(/^"|"$/g, "").trim();
}

function parseCsv(text: string, fileName = ""): ImportedRow[] {
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
  const findHeader = (names: string[], side: 0 | 1 = 0) => {
    const wanted = names.map(norm);
    const matches = header.map((h, index) => ({ key: norm(h), index })).filter(({ key }) => wanted.includes(key));
    // Barchart show-all exports repeat headers for CALL and PUT.
    if (matches.length > side) return matches[side].index;
    // Shared columns such as Strike appear once and apply to both sides.
    return side === 1 && matches.length === 1 ? matches[0].index : -1;
  };
  const strike = findHeader(["Strike", "Strike Price"]);
  const callType = findHeader(["Type", "Option Type"]);
  const putType = findHeader(["Type", "Option Type"], 1);
  const pairedSides = putType >= 0;
  if (strike < 0 || callType < 0)
    throw new Error("This is not a Barchart Volatility & Greeks CSV: Strike/Type columns not found.");
  const expiryMatch = fileName.match(/exp-(\d{1,2})_(\d{1,2})_(\d{2,4})/i);
  const expiryMonth = expiryMatch ? Number(expiryMatch[1]) : 10;
  const expiryDay = expiryMatch ? Number(expiryMatch[2]) : 13;
  const expiryYearRaw = expiryMatch ? Number(expiryMatch[3]) : 2026;
  const expiryYear = expiryYearRaw < 100 ? 2000 + expiryYearRaw : expiryYearRaw;
  const expiryDate = new Date(expiryYear, expiryMonth - 1, expiryDay, 23, 59, 59);
  const expiration = String(expiryMonth).padStart(2, "0") + "/" + String(expiryDay).padStart(2, "0") + "/" + expiryYear;
  const dte = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / 86400000));

  function make(r: string[], side: 0 | 1): ImportedRow | null {
    const findSide = (names: string[]) => findHeader(names, side);
    const typeCol = side === 1 ? putType : callType;
    const type = clean(r[typeCol]).toLowerCase();
    if (type !== "call" && type !== "put") return null;
    const strikeV = n(r[strike]);
    if (!strikeV) return null;
    const latest = findSide(["Latest", "Last", "Last Price"]);
    const iv = findSide(["IV", "Implied Volatility", "Volatility"]);
    const delta = findSide(["Delta"]);
    const gamma = findSide(["Gamma"]);
    const theta = findSide(["Theta"]);
    const vega = findSide(["Vega"]);
    const skew = findSide(["IV Skew", "Implied Volatility Skew"]);
    const time = findSide(["Last Trade", "Trade Time", "Time"]);
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
      ivSkew: skew >= 0 ? n(r[skew]) : undefined,
      dte,
      expiration,
      tradeTime: clean(time >= 0 ? r[time] : ""),
      percentFromLast: 0,
      baseLast: 0,
    };
  }
  const out: ImportedRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const call = make(rows[i], 0);
    if (call) out.push(call);
    if (pairedSides) {
      const put = make(rows[i], 1);
      if (put) out.push(put);
    }
  }
  if (!out.length) throw new Error("Barchart CSV was read, but no Call/Put rows were found.");

  const calls = out.filter((x) => x.type === "call").sort((a, b) => a.strike - b.strike);
  let baseLast = 0;
  for (let i = 0; i < calls.length - 1; i++) {
    const a = calls[i], b = calls[i + 1];
    if ((a.delta >= 0.5 && b.delta <= 0.5) || (a.delta <= 0.5 && b.delta >= 0.5)) {
      const denom = b.delta - a.delta;
      baseLast = denom ? a.strike + ((0.5 - a.delta) / denom) * (b.strike - a.strike) : a.strike;
      break;
    }
  }
  if (!baseLast && calls.length) {
    baseLast = calls.reduce((a, b) => Math.abs(a.delta - 0.5) < Math.abs(b.delta - 0.5) ? a : b).strike;
  }

  return out.map((x) => ({
    ...x,
    baseLast,
    percentFromLast: baseLast ? ((x.strike - baseLast) / baseLast) * 100 : 0,
  }));
}
export default function BarchartCsvImport() {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState<SavedImport[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  async function removeSaved(item: SavedImport) {
    if (!window.confirm(`Delete saved import “${item.sourceFile}” (${item.rowCount} rows) from Supabase?`)) return;
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/barchart/import?id=${encodeURIComponent(item.id)}`, { method: "DELETE", cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Could not delete import");
      setMsg(`Deleted ${item.sourceFile} from Supabase`);
      await refreshSaved();
      const latestResponse = await fetch("/api/barchart/import", { cache: "no-store" });
      const latestData = await latestResponse.json();
      window.dispatchEvent(new CustomEvent("barchart-csv", { detail: latestData?.ok && latestData.import ? { rows: latestData.import.rows, source: latestData.import.sourceFile, importedAt: latestData.import.importedAt } : { rows: [], source: "", importedAt: "" } }));
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Could not delete import");
    } finally { setBusyId(""); }
  }
  async function refreshSaved() {
    const response = await fetch("/api/barchart/import", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result?.ok) throw new Error(result?.error || "Could not load saved imports");
    setSaved(Array.isArray(result.imports) ? result.imports : []);
    return result;
  }
  useEffect(() => {
    let cancelled = false;
    fetch("/api/barchart/import", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result?.ok) throw new Error(result?.error || "Could not load latest import");
        if (!cancelled) setSaved(Array.isArray(result.imports) ? result.imports : []);
        if (!cancelled && result.import) {
          const when = result.import.importedAt ? new Date(result.import.importedAt).toLocaleString() : "saved";
          setMsg(`Latest import: ${result.import.rowCount} rows · ${when}`);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  async function toggleSaved() {
    const next = !savedOpen;
    setSavedOpen(next);
    if (next) {
      try { await refreshSaved(); }
      catch (error) { setMsg(error instanceof Error ? error.message : "Could not load saved imports"); }
    }
  }
  function open() {
    window.open(
      "https://www.barchart.com/futures/quotes/GC*0/volatility-greeks?futuresOptionsView=merged",
      "_blank",
      "noopener,noreferrer"
    );
  }
  function choose() {
    input.current?.click();
  }
  function read(file: File) {
    const reader = new FileReader();
    setMsg("Reading and saving CSV…");
    reader.onload = async () => {
      try {
        const rows = parseCsv(String(reader.result || ""), file.name);
        const response = await fetch("/api/barchart/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ sourceFile: file.name, rows }),
        });
        const result = await response.json();
        if (!response.ok || !result?.ok || !result?.import) {
          throw new Error(result?.error || "Supabase could not save this import.");
        }
        window.dispatchEvent(new CustomEvent("barchart-csv", {
          detail: { rows: result.import.rows, source: result.import.sourceFile, importedAt: result.import.importedAt },
        }));
        setMsg(`${rows.length} rows saved to Supabase`);
        try { await refreshSaved(); } catch {}
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not save CSV");
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
        <button className="ghost" onClick={toggleSaved} aria-expanded={savedOpen}>
          {savedOpen ? "Hide saved imports" : "Manage saved imports"} ({saved.length})
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
      {savedOpen && (
        <div className="savedImportsPanel" style={{ flexBasis: "100%", width: "100%", marginTop: 10, padding: 10, border: "1px solid var(--line, rgba(255,255,255,.15))", borderRadius: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <b>SUPABASE SAVED IMPORTS</b>
            <small>Delete removes that CSV import and its rows from the database.</small>
          </div>
          {saved.length ? saved.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid var(--line, rgba(255,255,255,.1))" }}>
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <b>{item.sourceFile}</b>
                <small style={{ display: "block", opacity: .7 }}>{item.rowCount} rows · {item.importedAt ? new Date(item.importedAt).toLocaleString() : "date unavailable"}</small>
              </span>
              <button className="ghost" disabled={busyId === item.id} onClick={() => removeSaved(item)} style={{ flexShrink: 0, borderColor: "rgba(255,100,100,.45)", color: "#ff9292" }}>
                {busyId === item.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          )) : <small>No saved Barchart imports found in Supabase.</small>}
        </div>
      )}
    </div>
  );
}
