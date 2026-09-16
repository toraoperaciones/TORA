/**
 * Verificación post-migración del schema TORA — vía Management API
 * (PostgREST no expone catálogos una vez que public tiene tablas).
 * Uso: pnpm db:verify   ·   Exit 1 si falta algo. NUNCA imprime llaves.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile(): Record<string, string> {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error("❌ .env.local no existe.");
    process.exit(1);
  }
  const vars: Record<string, string> = {};
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key) vars[key] = value;
  }
  return vars;
}

const env = { ...process.env, ...loadEnvFile() };
const PROJECT_ID = env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
const TOKEN = env.SUPABASE_ACCESS_TOKEN;

if (!PROJECT_ID || !TOKEN) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_PROJECT_ID o SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const API = "https://api.supabase.com";

async function sql(query: string): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(`${API}/v1/projects/${PROJECT_ID}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`query HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as Array<Record<string, unknown>>;
}

const EXPECTED_TABLES = [
  "tenants", "users", "trips", "trip_options", "bookings",
  "wallet_transactions", "invoices",
  "incidents", "notifications", "credit_lines", "pipeline_leads",
];

const EXPECTED_HELPERS = [
  "get_user_role", "get_user_tenant_id", "is_tora_staff", "set_updated_at", "handle_new_user",
];

const EXPECTED_RPC = [
  "select_trip_option", "replace_trip_options",
  "approve_deposit", "reject_deposit", "approve_credit_for_trip", "suspend_tenant",
  "activate_user", "update_user_role", "toggle_user_status", "toggle_tenant_status",
  "create_tenant", "invite_user",
];

const EXPECTED_TRIGGERS = ["on_auth_user_created"];
const EXPECTED_BUCKETS = ["receipts", "invoices"];
// 23 en public + 4 en storage (2 receipts + 2 invoices) = 27 totales.
const MIN_POLICIES_PUBLIC = 23;
const MIN_POLICIES_STORAGE = 4;

async function main() {
  console.log("\n== TORA · verify-schema ==\n");

  let failures = 0;
  const check = (ok: boolean, label: string, detail = "") => {
    if (!ok) failures++;
    console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  };

  // 1. Tablas
  const tables = await sql(
    "select tablename from pg_tables where schemaname = 'public' order by tablename"
  );
  const tableNames = new Set(tables.map((t) => String(t.tablename)));
  console.log("— Tablas public —");
  for (const t of EXPECTED_TABLES) check(tableNames.has(t), t);

  // 2. Helpers + RPCs (funciones en public)
  const funcs = await sql("select proname from pg_proc where pronamespace = 'public'::regnamespace");
  const fnNames = new Set(funcs.map((f) => String(f.proname)));
  console.log("\n— Helpers SQL —");
  for (const f of EXPECTED_HELPERS) check(fnNames.has(f), f);
  console.log("\n— RPCs —");
  for (const f of EXPECTED_RPC) check(fnNames.has(f), f);

  // 3. Trigger en auth.users
  const triggers = await sql(
    "select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal"
  );
  const triggerNames = new Set(triggers.map((t) => String(t.tgname)));
  console.log("\n— Triggers —");
  for (const t of EXPECTED_TRIGGERS) check(triggerNames.has(t), t);

  // 4. Buckets
  const buckets = await sql("select id from storage.buckets order by id");
  const bucketNames = new Set(buckets.map((b) => String(b.id)));
  console.log("\n— Buckets de storage —");
  for (const b of EXPECTED_BUCKETS) check(bucketNames.has(b), b);

  // 5. Policies RLS (public + storage)
  const policiesPublic = await sql("select policyname from pg_policies where schemaname = 'public'");
  const policiesStorage = await sql("select policyname from pg_policies where schemaname = 'storage'");
  console.log(
    `\n— Policies RLS — public: ${policiesPublic.length} (>= ${MIN_POLICIES_PUBLIC}) · storage: ${policiesStorage.length} (>= ${MIN_POLICIES_STORAGE})`
  );
  check(
    policiesPublic.length >= MIN_POLICIES_PUBLIC,
    `>= ${MIN_POLICIES_PUBLIC} policies en public`,
    `${policiesPublic.length} reales`
  );
  check(
    policiesStorage.length >= MIN_POLICIES_STORAGE,
    `>= ${MIN_POLICIES_STORAGE} policies en storage`,
    `${policiesStorage.length} reales`
  );

  console.log("\n" + "─".repeat(50));
  if (failures > 0) {
    console.error(`✗ ${failures} verificación(es) fallaron.\n`);
    process.exit(1);
  }
  console.log("✓ Schema completo y verificado.\n");
}

main().catch((err) => {
  console.error("✗ verify-schema falló:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
