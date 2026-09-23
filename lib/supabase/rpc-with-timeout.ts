import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ejecuta una RPC con timeout (default 10s). Si excede, regresa un error
 * legible en vez de colgar el request. Para las RPCs de dinero (approve,
 * settle, select) donde una red lenta no debe bloquear al usuario.
 */
export async function rpcWithTimeout<T = unknown>(
  client: SupabaseClient,
  fn: string,
  params: Record<string, unknown> = {},
  timeoutMs = 10_000
): Promise<{ data: T | null; error: Error | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data, error } = await client.rpc(fn, params).abortSignal(controller.signal);
    if (error) return { data: null, error: new Error(error.message) };
    return { data: (data ?? null) as T, error: null };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        data: null,
        error: new Error("La operación tardó demasiado. Intenta de nuevo."),
      };
    }
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  } finally {
    clearTimeout(timeout);
  }
}
