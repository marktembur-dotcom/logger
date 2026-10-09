import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, readMt5State } from "../../../lib/supabaseMt5Store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    if (!hasSupabaseAdminConfig()) {
      return NextResponse.json(
        {
          ok: false,
          live: false,
          feeds: {},
          events: [],
          error: "Persistent storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
          fetchedAt: new Date().toISOString(),
        },
        { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }
    const state = await readMt5State();
    return NextResponse.json(
      {
        ok: true,
        live: Object.keys(state.feeds).length > 0,
        feeds: state.feeds,
        events: state.events,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        live: false,
        feeds: {},
        events: [],
        error: e instanceof Error ? e.message : "Unable to load persistent MT5 state",
        fetchedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
