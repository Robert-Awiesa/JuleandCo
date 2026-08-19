import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Without this, a missing JWT_SECRET makes jwtVerify throw on every request
  // and the catch below silently bounces back to /admin/login — which looks
  // exactly like a wrong password. Say so out loud instead.
  if (!process.env.JWT_SECRET) {
    console.error(
      "[admin auth] JWT_SECRET is not set for the Next server, so the auth cookie can never verify " +
        "and every admin route will redirect to /admin/login. Copy frontend/.env.local.example to " +
        "frontend/.env.local, set JWT_SECRET to the same value as backend/.env, and restart `next dev`."
    );
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
