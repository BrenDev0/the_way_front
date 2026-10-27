import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/home", "/knowledge", "/members", "/welcome", "/skills"];
const GUEST_ONLY = ["/", "/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("session");

  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (hasSession && GUEST_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/home/:path*", "/knowledge/:path*", "/members/:path*", "/welcome/:path*", "/skills/:path*"],
};
