import { NextResponse, type NextRequest } from "next/server";

import {
  PORTAL_HOME,
  ROLE_TO_PORTAL,
  canAccess,
  homeForRole,
  isPublicPath,
  type Role,
} from "@/lib/auth/roles";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);

  const { pathname, search } = request.nextUrl;
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return NextResponse.redirect(url);
  };

  // 1. Sin sesión: solo rutas públicas.
  if (!user) {
    if (isPublicPath(pathname)) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // 2. Con sesión: perfil para role/status.
  //    Nota: el middleware corre en el Edge runtime. La consulta a public.users
  //    funciona vía PostgREST (HTTP), no vía pg.
  const { data: profile } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", user.id)
    .single();

  // Perfil inexistente → tratarlo como pendiente (el trigger lo crea al
  // registrarse; si falta, /pending es el destino seguro).
  const status = profile?.status ?? "pending_approval";
  const role = (profile?.role ?? "CLIENT_ADMIN") as Role;

  if (status === "pending_approval" || status === "suspended") {
    if (pathname !== "/pending") return redirectTo("/pending");
    return response;
  }

  // 3. Usuario activo: fuera de las páginas de auth.
  if (pathname === "/pending" || pathname === "/login" || pathname === "/register") {
    return redirectTo(homeForRole(role));
  }

  // 4. Protección por portal.
  if (!canAccess(role, pathname)) {
    return redirectTo(PORTAL_HOME[ROLE_TO_PORTAL[role]]);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
