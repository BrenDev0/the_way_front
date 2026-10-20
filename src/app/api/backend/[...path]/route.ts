import { NextRequest, NextResponse } from "next/server";
import { API_URL, SIGNING_SECRET, sign } from "@/shared/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORWARDED_REQUEST_HEADERS = ["content-type", "cookie", "accept"];
const SESSION_COOKIE = "session";
const SESSION_ERRORS = new Set(["not_authenticated", "invalid_session", "missing_session", "session_not_found"]);

function clientIp(req: NextRequest): string | null {
  const forwarded = (req.headers.get("x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  return forwarded.at(-1) ?? req.headers.get("x-real-ip");
}

function serviceUnavailable() {
  return NextResponse.json({ code: "service_unavailable" }, { status: 503 });
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!SIGNING_SECRET) {
    console.error("[proxy] REQUEST_SIGNING_SECRET is not set");
    return serviceUnavailable();
  }

  const { path } = await ctx.params;
  const pathWithQuery = `/api/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? Buffer.alloc(0) : Buffer.from(await req.arrayBuffer());
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  // The API sees this server, not the visitor, so it is told who the visitor is. The last
  // entry is the one Railway's edge added; anything left of it came from the visitor.
  // TEMPORARY: remove once we know which header carries the visitor's address on Railway.
  if (pathWithQuery.startsWith("/api/v1/auth/login")) {
    console.log(
      "[proxy-ip-debug]",
      JSON.stringify({
        xForwardedFor: req.headers.get("x-forwarded-for"),
        xRealIp: req.headers.get("x-real-ip"),
        forwarded: req.headers.get("forwarded"),
        cfConnectingIp: req.headers.get("cf-connecting-ip"),
        trueClientIp: req.headers.get("true-client-ip"),
        xRailwayEdge: req.headers.get("x-railway-edge"),
      }),
    );
  }
  const visitorIp = clientIp(req);
  if (visitorIp) headers.set("x-forwarded-for", visitorIp);
  headers.set("X-Timestamp", timestamp);
  headers.set("X-Signature", sign(method, pathWithQuery, timestamp, body));

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}${pathWithQuery}`, {
      method,
      headers,
      body: body.length ? body : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (err) {
    console.error(`[proxy] ${method} ${pathWithQuery} failed to reach ${API_URL}`, err);
    return serviceUnavailable();
  }

  if (upstream.status >= 500) {
    console.error(`[proxy] ${method} ${pathWithQuery} -> ${upstream.status}`, await upstream.text().catch(() => ""));
    return serviceUnavailable();
  }

  if (upstream.status === 401) {
    const text = await upstream.text().catch(() => "");
    const res = new NextResponse(text, { status: 401, headers: { "content-type": "application/json" } });
    let code: string | undefined;
    try {
      code = JSON.parse(text)?.code;
    } catch {}
    if (code && SESSION_ERRORS.has(code)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  const res = new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status });
  const contentType = upstream.headers.get("content-type");
  if (contentType) res.headers.set("content-type", contentType);
  for (const cookie of upstream.headers.getSetCookie()) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
