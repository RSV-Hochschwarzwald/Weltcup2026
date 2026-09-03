import { NextResponse, type NextRequest } from "next/server";

/**
 * Leichtgewichtiger Vor-Check ohne Supabase-SDK (das würde die Middleware-
 * Bundle-Größe auf Cloudflare unnötig aufblähen, siehe docs/ARCHITECTURE.md).
 * Prüft nur, ob überhaupt eine Supabase-Session-Cookie vorhanden ist, um
 * eindeutig ausgeloggte Besucher sofort zum Login umzuleiten.
 *
 * Die WIRKLICHE Sicherheitsprüfung (gültige Session + Admin-/Viewer-Rolle)
 * passiert weiterhin serverseitig in src/app/admin/(dashboard)/layout.tsx
 * über getCurrentAdmin() – diese Middleware ist reine UX-Optimierung, kein
 * Sicherheitsmechanismus.
 */
const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-.*-auth-token/;

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin") && path !== "/admin/login";

  if (!isAdminRoute) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.getAll().some((c) => SUPABASE_AUTH_COOKIE_PATTERN.test(c.name));

  if (!hasSessionCookie) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
