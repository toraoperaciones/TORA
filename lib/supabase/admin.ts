import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Node <22: supabase-js v2.116 exige WebSocket global al construir el cliente.
// No-op en Node 22+/browser (ya lo tienen) y no se bundea para el cliente.
import "../polyfill-websocket";

/**
 * ⚠️⚠️⚠️ NUNCA IMPORTAR ESTE ARCHIVO DESDE COMPONENTES CLIENTE ⚠️⚠️⚠️
 *
 * Cliente con SERVICE ROLE KEY: bypasea RLS por completo.
 * Uso exclusivo en servidor:
 *   - Scripts (seed, backfills)
 *   - Server Actions / Route Handlers de confianza
 *
 * Casos de uso en TORA: aprobar depósitos SPEI, crear bookings automáticos,
 * activar usuarios pendientes, operaciones administrativas.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "[supabase/admin] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. " +
        "Verifica .env.local."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      // No hay usuario real detrás: nada que refrescar ni persistir.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
