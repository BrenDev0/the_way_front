import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const SIGNING_SECRET = process.env.REQUEST_SIGNING_SECRET ?? "";
const FORWARDED_REQUEST_HEADERS = ["content-type", "cookie", "accept"];
const SESSION_COOKIE = "session";
const SESSION_ERRORS = new Set(["not_authenticated", "invalid_session", "missing_session", "session_not_found"]);

function sign(method: string, pathWithQuery: string, timestamp: string, body: Buffer) {
  const prefix = Buffer.from(`${method}\n${pathWithQuery}\n${timestamp}\n`, "utf8");
  return createHmac("sha256", SIGNING_SECRET).update(Buffer.concat([prefix, body])).digest("hex");
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
