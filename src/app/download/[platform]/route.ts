import { NextRequest, NextResponse } from "next/server";
import { installerLink } from "@/features/downloads/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The button's target: asks the API for a fresh signed link and sends the browser straight
// to the bucket, so the installer never passes through this server.
export async function GET(req: NextRequest, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const link = await installerLink(platform);
  if (link === "missing") return NextResponse.redirect(new URL(`/download?missing=${encodeURIComponent(platform)}`, req.url));
  if (link === null) return NextResponse.redirect(new URL("/download?error=1", req.url));
  return NextResponse.redirect(link, 302);
}
