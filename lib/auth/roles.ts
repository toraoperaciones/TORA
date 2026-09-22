export type Role =
  | "CLIENT_ADMIN"
  | "CLIENT_FINANCE"
  | "TORA_OPS"
  | "TORA_ADMIN"
  | "TORA_FINANCE";

export type Portal = "client" | "ops" | "admin" | "finance";

export const ROLE_TO_PORTAL: Record<Role, Portal> = {
  CLIENT_ADMIN: "client",
  CLIENT_FINANCE: "client",
  TORA_OPS: "ops",
  TORA_ADMIN: "admin",
  TORA_FINANCE: "finance",
};

export const PORTAL_HOME: Record<Portal, string> = {
  client: "/dashboard",
  ops: "/ops/inbox",
  admin: "/admin/tenants",
  finance: "/finance/deposits",
};

/** Roles internos de TORA (staff). TORA_ADMIN tiene acceso universal. */
const STAFF_ALL_ACCESS: Role = "TORA_ADMIN";

/** Rutas accesibles sin sesión. `/auth/*` se cubre por prefijo en isPublicPath. */
export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/pending",
  "/auth",
  "/aviso-privacidad",
  "/terminos",
];

/**
 * Devuelve true si la ruta es pública (accesible sin sesión).
 * `/auth/*` cubre `/auth/callback`.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return true;
  return PUBLIC_PATHS.includes(pathname);
}

/** Prefijo de ruta → portal requerido (el más específico gana). */
const PORTAL_PREFIXES: Array<[string, Portal]> = [
  ["/ops", "ops"],
  ["/finance", "finance"],
  ["/admin", "admin"],
  ["/dashboard", "client"],
  ["/wallet", "client"],
  ["/trips", "client"],
  ["/invoices", "client"],
];

export function portalForPath(pathname: string): Portal | null {
  for (const [prefix, portal] of PORTAL_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return portal;
  }
  return null;
}

/**
 * ¿Puede `role` acceder a `pathname`?
 * TORA_ADMIN tiene acceso universal; el resto solo a su portal.
 * Las rutas sin portal asignado (públicas u otras) se permiten.
 */
export function canAccess(role: Role, pathname: string): boolean {
  if (role === STAFF_ALL_ACCESS) return true;
  const required = portalForPath(pathname);
  if (required === null) return true;
  return ROLE_TO_PORTAL[role] === required;
}

/** Home del portal correspondiente al rol. */
export function homeForRole(role: Role): string {
  return PORTAL_HOME[ROLE_TO_PORTAL[role]];
}
