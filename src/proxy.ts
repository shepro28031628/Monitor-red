import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");

  if (isAuthRoute) return NextResponse.next();

  if (isApiRoute) {
    console.log(`[Middleware] API Request to ${req.nextUrl.pathname} | isLoggedIn: ${isLoggedIn} | Host: ${req.headers.get("host")}`);
  }

  if (isLoginPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // RBAC for admin routes
  const isAdminRoute = req.nextUrl.pathname.startsWith("/audit") || req.nextUrl.pathname.startsWith("/explorer");
  const userRole = (req.auth?.user as any)?.role;

  if (isAdminRoute && userRole !== "ADMIN") {
    if (isApiRoute) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.nextUrl)); // Redirect to dashboard instead
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
