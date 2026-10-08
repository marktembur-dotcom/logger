import { NextResponse } from "next/server";
import { getMt5State } from "../../../lib/mt5Store";

export async function GET() {
  const state = getMt5State();
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
}
