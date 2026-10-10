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
        {msg && <span className={"importMsg " + (msg.startsWith("Deleted ") ? "importMsgDeleted" : "")} title={msg}>{msg}</span>}
      </div>
      {savedOpen && (
        <div className="savedImportsBackdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSavedOpen(false); }}>
          <section className="savedImportsWindow" role="dialog" aria-modal="true" aria-label="Saved Barchart imports">
            <header className="savedImportsHeader">
              <div><small>DATA MANAGEMENT · BARCHART</small><h3>Saved imports <span>{saved.length}</span></h3></div>
              <button className="savedImportsClose" onClick={() => setSavedOpen(false)} aria-label="Close saved imports">×</button>
            </header>
            <p className="savedImportsHint">Stored in Supabase. Deleting an import removes only that file and its rows.</p>
            <div className="savedImportsList">
              {saved.length ? saved.map((item) => (
                <div className="savedImportRow" key={item.id}>
                  <span className="savedImportGlyph">CSV</span>
                  <span className="savedImportDetails">
                    <b title={item.sourceFile}>{item.sourceFile}</b>
                    <small>{item.rowCount.toLocaleString()} rows <i>·</i> {item.importedAt ? new Date(item.importedAt).toLocaleString() : "date unavailable"}</small>
                  </span>
                  <button className="savedImportDelete" disabled={busyId === item.id} onClick={() => removeSaved(item)}>
                    {busyId === item.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              )) : <div className="savedImportsEmpty">No saved Barchart imports found in Supabase.</div>}
            </div>
            <footer className="savedImportsFooter"><span>{saved.length} saved file{saved.length === 1 ? "" : "s"}</span><button className="savedImportsDone" onClick={() => setSavedOpen(false)}>Done</button></footer>
          </section>
          <style jsx>{`
            .importMsgDeleted{display:inline-block;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;font-size:10px!important;line-height:1.35;padding:5px 8px;border:1px solid rgba(103,240,173,.2);border-radius:5px;background:rgba(103,240,173,.06);color:#83e5b2}
            .savedImportsBackdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:22px;background:rgba(3,7,14,.78);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
            .savedImportsWindow{width:min(680px,calc(100vw - 32px));max-height:min(78vh,760px);display:flex;flex-direction:column;overflow:hidden;color:#e7edf5;background:linear-gradient(145deg,rgba(17,25,39,.99),rgba(8,13,23,.99));border:1px solid rgba(244,201,107,.3);border-radius:13px;box-shadow:0 24px 90px rgba(0,0,0,.62),inset 0 1px rgba(255,255,255,.045)}
            .savedImportsHeader{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:20px 22px 15px;border-bottom:1px solid rgba(255,255,255,.08)}
            .savedImportsHeader small{font-size:9px;letter-spacing:1.5px;color:#d9b86b}
            .savedImportsHeader h3{margin:6px 0 0;font-size:20px;font-weight:550;letter-spacing:-.4px}
            .savedImportsHeader h3 span{display:inline-grid;place-items:center;min-width:24px;height:22px;margin-left:6px;padding:0 6px;border-radius:5px;background:rgba(244,201,107,.12);color:#f4c96b;font-size:11px}
            .savedImportsClose{width:32px;height:32px;border:1px solid rgba(255,255,255,.12);border-radius:7px;background:rgba(255,255,255,.035);color:#c6cfdb;font-size:23px;line-height:1;cursor:pointer}
            .savedImportsHint{margin:0;padding:12px 22px;color:#929fb1;font-size:11px;line-height:1.5}
            .savedImportsList{overflow:auto;min-height:90px;padding:0 22px;overscroll-behavior:contain}
            .savedImportRow{display:flex;align-items:center;gap:12px;padding:13px 0;border-top:1px solid rgba(255,255,255,.065)}
            .savedImportGlyph{display:grid;place-items:center;flex:0 0 38px;height:38px;border:1px solid rgba(85,231,255,.18);border-radius:7px;background:rgba(85,231,255,.06);color:#76e7f4;font-size:9px;font-weight:700;letter-spacing:.5px}
            .savedImportDetails{min-width:0;flex:1}
            .savedImportDetails b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:550}
            .savedImportDetails small{display:block;margin-top:5px;color:#8e9aab;font-size:10px;line-height:1.4}
            .savedImportDetails i{padding:0 4px;color:#d9b86b;font-style:normal}
            .savedImportDelete{flex-shrink:0;padding:7px 10px;border:1px solid rgba(255,112,112,.3);border-radius:6px;background:rgba(255,85,85,.06);color:#ff9b9b;font-size:10px;cursor:pointer}
            .savedImportDelete:disabled{opacity:.5;cursor:wait}
            .savedImportsEmpty{padding:36px 10px;text-align:center;color:#8d9aad;font-size:12px}
            .savedImportsFooter{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 22px;border-top:1px solid rgba(255,255,255,.08);color:#8995a6;font-size:10px}
            .savedImportsDone{padding:8px 16px;border:1px solid rgba(244,201,107,.35);border-radius:6px;background:rgba(244,201,107,.1);color:#f4d78e;font-size:11px;font-weight:600;cursor:pointer}
            @media(max-width:520px){.savedImportsBackdrop{padding:10px}.savedImportsWindow{width:100%;max-height:84vh}.savedImportsHeader{padding:16px}.savedImportsHint{padding:10px 16px}.savedImportsList{padding:0 16px}.savedImportsFooter{padding:12px 16px}.savedImportRow{gap:8px}.savedImportGlyph{flex-basis:32px;height:32px}.savedImportDetails b{font-size:11px}.savedImportDelete{padding:7px}}
          `}</style>
        </div>
      )}
    </div>
  );
}
