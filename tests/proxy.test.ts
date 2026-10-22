// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let fetchMock: ReturnType<typeof vi.fn>;
let proxy: (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("REQUEST_SIGNING_SECRET", "test-secret");
  vi.stubEnv("API_URL", "http://api.internal:8000");
  fetchMock = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  proxy = (await import("@/app/api/backend/[...path]/route")).POST;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function send(path: string[]) {
  const req = new NextRequest(`http://panel.example/api/backend/${path.join("/")}`, { method: "POST", body: "{}" });
  return proxy(req, { params: Promise.resolve({ path }) });
}

describe("the backend relay", () => {
  it.each([["staff/auth/login"], ["staff/owner-invitations"], ["staff/auth/me"]])(
    "does not carry %s: staff routes are not the customers' panel's to reach",
    async (path) => {
      const res = await send(path.split("/"));

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ code: "not_found" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("still signs and forwards the customers' routes, the owner accept page's included", async () => {
    for (const path of [["auth", "login"], ["owner-invitations", "accept"], ["invitations", "accept"]]) {
      fetchMock.mockClear();

      const res = await send(path);

      expect(res.status).toBe(200);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`http://api.internal:8000/api/v1/${path.join("/")}`);
      expect((init.headers as Headers).get("X-Signature")).toBeTruthy();
    }
  });
});
