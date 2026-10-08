export type Mt5Tier = "early" | "partial" | "confirmed" | "watch";
export type Mt5Source = "WIN" | "XAU5" | "XAU1";

export type Mt5Event = {
  id: string;
  source: Mt5Source;
  tier: Mt5Tier;
  signal: string;
  symbol: string;
  tf: string;
  price: number;
  score?: number;
  confidence?: string;
  side?: "buy" | "sell";
  entry?: number;
  sl?: number;
  tp?: number;
  zoneHigh?: number;
  zoneLow?: number;
  reason?: string;
  seq?: string;
  measuredProb?: number;
  time: string;
  receivedAt: string;
};

export type Mt5State = {
  feeds: Partial<Record<Mt5Source, Mt5Event>>;
  events: Mt5Event[];
};

declare global {
  // eslint-disable-next-line no-var
  var __mt5State: Mt5State | undefined;
}

function store(): Mt5State {
  if (!globalThis.__mt5State) {
    globalThis.__mt5State = { feeds: {}, events: [] };
  }
  return globalThis.__mt5State;
}

export function getMt5State(): Mt5State {
  return store();
}

export function ingestMt5Event(
  raw: Omit<Mt5Event, "id" | "receivedAt"> & { id?: string }
): Mt5Event {
  const event: Mt5Event = {
    ...raw,
    id: raw.id || `${raw.source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: new Date().toISOString(),
  };
  const s = store();
  s.feeds[event.source] = event;
  s.events = [event, ...s.events].slice(0, 80);
  return event;
}
