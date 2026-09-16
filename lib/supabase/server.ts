import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Node <22: supabase-js exige WebSocket global al construir el cliente.
// No-op en Node 22+/browser. Solo bundlea en servidor (no se importa desde cliente).
import "../polyfill-websocket";

/**
 * Cliente Supabase para Server Components / Server Actions / Route Handlers.
 * Lee cookies de la petición; el refresh de sesión lo maneja middleware (Fase 3).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // En RSC no se pueden escribir cookies (llamada desde Server Component).
            // Es seguro ignorarlo: middleware refresca la sesión en cada request.
          }
        },
      },
    }
  );
}
