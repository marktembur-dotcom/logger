import { NextResponse } from "next/server";
import { ingestMt5Event, type Mt5Source, type Mt5Tier } from "../../../lib/mt5Store";
import { hasSupabaseAdminConfig, saveMt5Event } from "../../../lib/supabaseMt5Store";

const SOURCES: Mt5Source[] = ["WIN", "XAU5", "XAU1"];
const TIERS: Mt5Tier[] = ["early", "partial", "confirmed", "watch"];

function authorized(req: Request) {
  const expected = process.env.MT5_INGEST_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(req.url).searchParams.get("token") || "";
  return bearer === expected || query === expected;
}

export async function POST(req: Request) {
  try {
    if (!process.env.MT5_INGEST_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "MT5_INGEST_TOKEN is not set on the server." },
        { status: 503 }
      );
    }
    if (!authorized(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!hasSupabaseAdminConfig()) {
      return NextResponse.json(
        { ok: false, error: "Persistent storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const source = String(body.source || "").toUpperCase() as Mt5Source;
    const tier = String(body.tier || "").toLowerCase() as Mt5Tier;

    if (!SOURCES.includes(source)) {
      return NextResponse.json(
        { ok: false, error: "source must be WIN, XAU5, or XAU1" },
        { status: 400 }
      );
    }
    if (!TIERS.includes(tier)) {
      return NextResponse.json(
        { ok: false, error: "tier must be early, partial, confirmed, or watch" },
        { status: 400 }
      );
    }

    const event = ingestMt5Event({
      source,
      tier,
      signal: String(body.signal || tier),
      symbol: String(body.symbol || "XAUUSD"),
      tf: String(body.tf || ""),
      price: Number(body.price) || 0,
      score: body.score != null ? Number(body.score) : undefined,
      confidence: body.confidence ? String(body.confidence) : undefined,
      side: body.side === "buy" || body.side === "sell" ? body.side : undefined,
      entry: body.entry != null ? Number(body.entry) : undefined,
      sl: body.sl != null ? Number(body.sl) : undefined,
      tp: body.tp != null ? Number(body.tp) : undefined,
      zoneHigh: body.zoneHigh != null ? Number(body.zoneHigh) : undefined,
      zoneLow: body.zoneLow != null ? Number(body.zoneLow) : undefined,
      reason: body.reason ? String(body.reason) : undefined,
      seq: body.seq ? String(body.seq) : undefined,
      measuredProb: body.measuredProb != null ? Number(body.measuredProb) : undefined,
      time: body.time ? String(body.time) : new Date().toISOString(),
    });

    await saveMt5Event(event);
    return NextResponse.json(
      { ok: true, persisted: true, event },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Invalid payload" },
      { status: 503 }
    );
  }
}
