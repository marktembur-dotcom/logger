import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supabaseHeaders(extra?: Record<string, string>): HeadersInit {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.");
  }
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function endpoint(path: string) {
  if (!SUPABASE_URL) throw new Error("SUPABASE_URL is not configured.");
  return `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;
}

export async function GET() {
  try {
    const response = await fetch(
      endpoint("barchart_imports?select=id,source_file,row_count,rows,imported_at&order=imported_at.desc&limit=1"),
      { headers: supabaseHeaders(), cache: "no-store" }
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase read failed (${response.status}): ${detail.slice(0, 250)}`);
    }
    const records = (await response.json()) as Array<{
      id: string;
      source_file: string;
      row_count: number;
      rows: unknown[];
      imported_at: string;
    }>;
    const latest = records[0] || null;
    return NextResponse.json(
      { ok: true, import: latest ? {
        id: latest.id,
        sourceFile: latest.source_file,
        rowCount: latest.row_count,
        rows: latest.rows,
        importedAt: latest.imported_at,
      } : null },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load Barchart import" },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows = body?.rows;
    const sourceFile = typeof body?.sourceFile === "string" ? body.sourceFile.slice(0, 255) : "Barchart CSV";
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 20000) {
      return NextResponse.json({ ok: false, error: "Import must contain between 1 and 20,000 parsed rows." }, { status: 400 });
    }
    const validRows = rows.every((row) =>
      row && (row.type === "call" || row.type === "put") &&
      Number.isFinite(Number(row.strike)) && Number(row.strike) > 0
    );
    if (!validRows) {
      return NextResponse.json({ ok: false, error: "The CSV contains invalid option rows. Please re-import the Barchart CSV." }, { status: 400 });
    }

    const response = await fetch(endpoint("barchart_imports"), {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify({ source_file: sourceFile, row_count: rows.length, rows }),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase save failed (${response.status}): ${detail.slice(0, 250)}`);
    }
    const saved = (await response.json()) as Array<{ id: string; imported_at: string; row_count: number }>;
    return NextResponse.json(
      { ok: true, import: { id: saved[0]?.id, sourceFile, rowCount: rows.length, rows, importedAt: saved[0]?.imported_at } },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to save Barchart import" },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
