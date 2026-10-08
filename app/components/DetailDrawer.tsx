"use client";

import { useMemo, useState } from "react";

type Level = {
  strike: number;
  score: number;
  gamma: number;
  delta: number;
  callIv: number;
  putIv: number;
  dte: number;
  oi: number;
  volume: number;
  distance: number;
  side: "CALL" | "PUT";
  label: string;
};

function fmt(n: number, d = 1) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });
}

export default function DetailDrawer({
  open,
  onClose,
  levels,
  price,
  rowsCount,
}: {
  open: boolean;
  onClose: () => void;
  levels: Level[];
  price: number;
  rowsCount: number;
}) {
  const [range, setRange] = useState<"atm" | "near" | "wide" | "all">("near");

  const filtered = useMemo(() => {
    let x = [...levels];
    if (range === "atm") x = x.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance)).slice(0, 8);
    else if (range === "near") x = x.filter((a) => Math.abs(a.distance) <= 30);
    else if (range === "wide") x = x.filter((a) => Math.abs(a.distance) <= 60);
    return x;
  }, [levels, range]);

  if (!open) return null;

  return (
    <div className="glassOverlay" onClick={onClose}>
      <div className="glassDrawer" onClick={(e) => e.stopPropagation()}>
        <div className="glassShine" />
        <div className="glassHead">
          <div>
            <b>EXPANDED MARKET DATA</b>
            <small>
              {rowsCount} option rows · spot {price ? fmt(price, 2) : "—"} · near-money & full levels
            </small>
          </div>
          <button type="button" className="iconBtn" onClick={onClose}>
            CLOSE
          </button>
        </div>

        <div className="glassFilters">
          {(
            [
              ["atm", "ATM FOCUS"],
              ["near", "NEAR PRICE (±30)"],
              ["wide", "WIDE (±60)"],
              ["all", "ALL LEVELS"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={"glassChip" + (range === id ? " on" : "")}
              onClick={() => setRange(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="glassBody">
          <div className="glassTableHead">
            <span>RANK</span>
            <span>STRIKE</span>
            <span>SCORE</span>
            <span>DIST</span>
            <span>GAMMA</span>
            <span>DELTA</span>
            <span>CALL IV</span>
            <span>PUT IV</span>
            <span>SKEW</span>
            <span>DTE</span>
            <span>SIDE</span>
            <span>LABEL</span>
          </div>
          {filtered.length ? (
            filtered.map((l, i) => (
              <div className="glassRow" key={l.strike}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{fmt(l.strike, 0)}</b>
                <span className="score">{l.score}</span>
                <span>
                  {l.distance > 0 ? "+" : ""}
                  {fmt(l.distance, 1)}
                </span>
                <span>{l.gamma.toFixed(5)}</span>
                <span>{l.delta.toFixed(3)}</span>
                <span>{fmt(l.callIv, 2)}%</span>
                <span>{fmt(l.putIv, 2)}%</span>
                <span style={{ color: l.putIv - l.callIv >= 0 ? "var(--c4)" : "var(--c1)" }}>
                  {fmt(l.putIv - l.callIv, 2)}
                </span>
                <span>{l.dte}</span>
                <span>{l.side}</span>
                <span className="label">{l.label}</span>
              </div>
            ))
          ) : (
            <div className="empty">No levels in this range — import Barchart CSV</div>
          )}
        </div>

        <div className="glassFoot">
          <span>Click outside to retract</span>
          <span>
            Showing <b>{filtered.length}</b> of <b>{levels.length}</b> ranked levels
          </span>
        </div>
      </div>
    </div>
  );
}
