import { NextResponse } from "next/server";

const PAGE = "https://www.barchart.com/futures/quotes/GCZ26/volatility-greeks/IY6V26?futuresOptionsView=split";
const API = "https://www.barchart.com/proxies/core-api/v1/options/get";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";
const fields = [
  "symbol","baseSymbol","strikePrice","moneyness","bidPrice","midpoint","askPrice",
  "lastPrice","priceChange","percentChange","volume","openInterest",
  "volatility","optionType","daysToExpiration","expirationDate","tradeTime",
  "delta","gamma","theta","vega","percentFromLast","baseLastPrice"
].join(",");

function cookiesFrom(headers: Headers) {
  const out: string[] = [];
  const h = headers as Headers & { getSetCookie?: () => string[] };
  const values = h.getSetCookie?.() ?? [];
  if (values.length) return values.map(x => x.split(";")[0]).join("; ");
  const single = headers.get("set-cookie");
  if (single) return single.split(/,(?=[^;,]+=)/).map(x => x.split(";")[0]).join("; ");
  return "";
}

function tokenFrom(cookie: string) {
  const m = cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

async function barchart(params: URLSearchParams, cookie: string, token: string) {
  const r = await fetch(API + "?" + params.toString(), {
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "x-xsrf-token": token,
      cookie,
      referer: PAGE,
      "user-agent": UA,
    },
    cache: "no-store",
  });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: r.ok, status: r.status, json, text };
}

export async function GET(request: Request) {
  try {
    const incoming = new URL(request.url);
    const expiration = incoming.searchParams.get("expiration") || "nearest";
    const strikeLimit = incoming.searchParams.get("limit") || "80";

    const page = await fetch(PAGE, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
    });
    const cookie = cookiesFrom(page.headers);
    const token = tokenFrom(cookie);
    if (!cookie || !token) {
      return NextResponse.json({ live: false, error: "Barchart session token was not returned." }, { status: 502 });
    }

    const common = {
      fields,
      groupBy: "optionType",
      meta: "field.shortName,expirations,field.description",
      orderBy: "strikePrice",
      orderDir: "asc",
      raw: "1",
      limit: strikeLimit,
    };

    const attempts: Record<string, string>[] = [
      { baseSymbol: "$GCZ26", expirationDate: expiration },
      { baseSymbol: "GCZ26", expirationDate: expiration },
      { symbols: "IY6V26", expirationDate: expiration },
    ];

    let result: any = null;
    let used: any = null;
    for (const attempt of attempts) {
      const p = new URLSearchParams({ ...common, ...attempt });
      const r = await barchart(p, cookie, token);
      if (r.ok && r.json?.data && Object.keys(r.json.data).length) {
        result = r.json;
        used = attempt;
        break;
      }
    }

    if (!result) {
      return NextResponse.json({ live: false, error: "Barchart session worked, but the options endpoint returned no GC rows.", source: PAGE }, { status: 502 });
    }

    const rawRows = Object.values(result.data).flatMap((group: any) =>
      Array.isArray(group) ? group : []
    ).map((item: any) => item?.raw ?? item).filter(Boolean);

    const rows = rawRows.map((r: any) => ({
      symbol: r.symbol,
      type: r.optionType,
      strike: Number(String(r.strikePrice ?? "").replace(/,/g, "")),
      bid: Number(r.bidPrice) || 0,
      ask: Number(r.askPrice) || 0,
      last: Number(r.lastPrice) || 0,
      volume: Number(String(r.volume ?? "0").replace(/,/g, "")) || 0,
      openInterest: Number(String(r.openInterest ?? "0").replace(/,/g, "")) || 0,
      iv: Number(String(r.volatility ?? "0").replace("%","")) || 0,
      delta: Number(r.delta) || 0,
      gamma: Number(r.gamma) || 0,
      theta: Number(r.theta) || 0,
      vega: Number(r.vega) || 0,
      dte: Number(r.daysToExpiration) || 0,
      expiration: r.expirationDate,
      tradeTime: r.tradeTime,
      percentFromLast: Number(String(r.percentFromLast ?? "0").replace("%","")) || 0,
      baseLast: Number(String(r.baseLastPrice ?? "0").replace(/,/g, "")) || 0,
    }));

    return NextResponse.json({
      live: true,
      source: PAGE,
      fetchedAt: new Date().toISOString(),
      contract: "GCZ26",
      used,
      expirations: result?.meta?.expirations ?? null,
      rows,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ live: false, error: error instanceof Error ? error.message : "Unknown Barchart adapter error" }, { status: 502 });
  }
}
