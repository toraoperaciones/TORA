/**
 * Verifica que las variables de entorno requeridas existan.
 * NUNCA imprime valores — solo nombres y estado (✅/❌).
 * Exit 1 si falta alguna.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PROJECT_ID",
] as const;

const OPTIONAL = ["SUPABASE_ACCESS_TOKEN", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_TZ"] as const;

// Cargar .env.local manualmente (tsx no lo carga automáticamente).
function loadEnvFile(): Record<string, string> {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error("❌ .env.local no existe en la raíz del proyecto.");
    process.exit(1);
  }
  const vars: Record<string, string> = {};
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) vars[key] = value;
  }
  return vars;
}

const env = { ...process.env, ...loadEnvFile() };

let missing = 0;
console.log("\n== TORA · env:check ==\n");
for (const key of REQUIRED) {
  const ok = Boolean(env[key] && env[key].length > 0);
  if (!ok) missing++;
  console.log(`  ${ok ? "✅" : "❌"} ${key}${ok ? " — configurada" : " — FALTA"}`);
}
for (const key of OPTIONAL) {
  const ok = Boolean(env[key] && env[key].length > 0);
  console.log(`  ${ok ? "✅" : "⚪"} ${key}${ok ? " — configurada (opcional)" : " — no definida (opcional)"}`);
}

// Validaciones de formato sin revelar valores.
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (url && !url.startsWith("https://")) {
  console.error("\n❌ NEXT_PUBLIC_SUPABASE_URL no empieza con https:// — formato inválido.");
  missing++;
}
const srk = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (srk && srk.length < 40) {
  console.error("\n❌ SUPABASE_SERVICE_ROLE_KEY parece demasiado corta — revisa que sea la secret y no otra llave.");
  missing++;
}

console.log("");
if (missing > 0) {
  console.error(`✗ ${missing} problema(s) de entorno. Revisa .env.local.\n`);
  process.exit(1);
}
console.log("✓ Entorno completo.\n");
