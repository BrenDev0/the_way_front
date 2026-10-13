import { createHmac } from "node:crypto";

// Server-only: the API's private address and the secret every request to it is signed
// with. Read when the server starts, so one build runs against any backend.
export const API_URL = process.env.API_URL ?? "http://localhost:8000";
export const SIGNING_SECRET = process.env.REQUEST_SIGNING_SECRET ?? "";

export function sign(method: string, pathWithQuery: string, timestamp: string, body: Buffer) {
  const prefix = Buffer.from(`${method}\n${pathWithQuery}\n${timestamp}\n`, "utf8");
  return createHmac("sha256", SIGNING_SECRET).update(Buffer.concat([prefix, body])).digest("hex");
}

/** A GET to the API from this server, signed like the relay signs the browser's calls. */
export async function backendGet(path: string): Promise<Response> {
  if (!SIGNING_SECRET) throw new Error("REQUEST_SIGNING_SECRET is not set");
  const pathWithQuery = `/api/v1${path}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return fetch(`${API_URL}${pathWithQuery}`, {
    headers: { "X-Timestamp": timestamp, "X-Signature": sign("GET", pathWithQuery, timestamp, Buffer.alloc(0)) },
    cache: "no-store",
  });
}
