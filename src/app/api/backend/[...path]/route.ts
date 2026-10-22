import { NextRequest, NextResponse } from "next/server";
import { API_URL, SIGNING_SECRET, sign } from "@/shared/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORWARDED_REQUEST_HEADERS = ["content-type", "cookie", "accept"];
const SESSION_COOKIE = "session";
const SESSION_ERRORS = new Set(["not_authenticated", "invalid_session", "missing_session", "session_not_found"]);

// Railway's edge sends "<visitor>, <its own proxy address>": the visitor is second from the
// right. Counting from the right keeps it out of reach of entries the visitor adds on the left.
const PROXY_HOPS = 2;

function clientIp(req: NextRequest): string | null {
  const forwarded = (req.headers.get("x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  return forwarded.length >= PROXY_HOPS ? forwarded[forwarded.length - PROXY_HOPS] : null;
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
  // Xplorers' staff routes belong to its own dashboard, never to the customers' panel: this
  // proxy signs whatever it forwards, so without this a visitor could reach them from here.
  if (path[0] === "staff") return NextResponse.json({ code: "not_found" }, { status: 404 });

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
