"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para el navegador (Client Components).
 * Usa la anon key — todas las operaciones quedan limitadas por RLS.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
