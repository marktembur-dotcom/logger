import type { Mt5Event, Mt5Source, Mt5State } from "./mt5Store";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasSupabaseAdminConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function headers(extra?: Record<string, string>): HeadersInit {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function endpoint(path: string) {
  if (!SUPABASE_URL) throw new Error("SUPABASE_URL is not configured on the server.");
  return `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;
}

type DbRow = {
  id: string;
  source: Mt5Source;
  tier: Mt5Event["tier"];
  signal: string;
  symbol: string;
  tf: string;
  price: number;
  score: number | null;
  confidence: string | null;
  side: Mt5Event["side"] | null;
  entry: number | null;
  sl: number | null;
  tp: number | null;
  zone_high: number | null;
  zone_low: number | null;
  reason: string | null;
  seq: string | null;
  measured_prob: number | null;
  event_time: string;
  received_at: string;
};

function fromRow(row: DbRow): Mt5Event {
  return {
    id: row.id,
    source: row.source,
    tier: row.tier,
    signal: row.signal,
    symbol: row.symbol,
    tf: row.tf,
    price: Number(row.price || 0),
    score: row.score == null ? undefined : Number(row.score),
    confidence: row.confidence || undefined,
    side: row.side || undefined,
    entry: row.entry == null ? undefined : Number(row.entry),
    sl: row.sl == null ? undefined : Number(row.sl),
    tp: row.tp == null ? undefined : Number(row.tp),
    zoneHigh: row.zone_high == null ? undefined : Number(row.zone_high),
    zoneLow: row.zone_low == null ? undefined : Number(row.zone_low),
    reason: row.reason || undefined,
    seq: row.seq || undefined,
    measuredProb: row.measured_prob == null ? undefined : Number(row.measured_prob),
    time: row.event_time,
    receivedAt: row.received_at,
  };
}

export async function saveMt5Event(event: Mt5Event): Promise<Mt5Event> {
  const row = {
    id: event.id,
    source: event.source,
    tier: event.tier,
    signal: event.signal,
    symbol: event.symbol,
    tf: event.tf,
    price: event.price,
    score: event.score ?? null,
    confidence: event.confidence ?? null,
    side: event.side ?? null,
    entry: event.entry ?? null,
    sl: event.sl ?? null,
    tp: event.tp ?? null,
    zone_high: event.zoneHigh ?? null,
    zone_low: event.zoneLow ?? null,
    reason: event.reason ?? null,
    seq: event.seq ?? null,
    measured_prob: event.measuredProb ?? null,
    event_time: event.time,
    received_at: event.receivedAt,
    payload: event,
  };
  const response = await fetch(endpoint("mt5_events?on_conflict=id"), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase save failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return event;
}

export async function readMt5State(): Promise<Mt5State> {
  const response = await fetch(
    endpoint("mt5_events?select=id,source,tier,signal,symbol,tf,price,score,confidence,side,entry,sl,tp,zone_high,zone_low,reason,seq,measured_prob,event_time,received_at&order=received_at.desc&limit=200"),
    { headers: headers(), cache: "no-store" }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase read failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const rows = (await response.json()) as DbRow[];
  const events = rows.map(fromRow);
  const feeds: Mt5State["feeds"] = {};
  // Events are newest first; preserve the latest event for each source.
  for (const event of events) if (!feeds[event.source]) feeds[event.source] = event;
  return { feeds, events };
}
