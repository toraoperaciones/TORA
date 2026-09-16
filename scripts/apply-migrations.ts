/**
 * Aplica las migraciones de supabase/migrations en orden vía la Management API
 * de Supabase, usando SUPABASE_ACCESS_TOKEN (sbp_...).
 *
 * - Registra cada migración en supabase_migrations.schema_migrations
 *   (mismo formato que supabase db push) para trazabilidad.
 * - Idempotente: si una versión ya está registrada, se salta.
 * - Modo --force: re-ejecuta aunque ya esté registrada (prueba de idempotencia).
 *
 * Uso:
 *   pnpm db:migrate            # aplica las pendientes
 *   pnpm db:migrate -- --force # re-ejecuta todas (valida idempotencia)
 *
 * NUNCA imprime el token.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
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
const API = "https://api.supabase.com";

if (!PROJECT_ID || !TOKEN) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_PROJECT_ID o SUPABASE_ACCESS_TOKEN en .env.local.");
  process.exit(1);
}

const FORCE = process.argv.includes("--force");

async function mgmt(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

interface MigrationRow {
  version: string;
  name: string | null;
}

async function main() {
  console.log("\n== TORA · db:migrate ==\n");

  // 0. Verificar acceso.
  const me = await mgmt(`/v1/projects/${PROJECT_ID}`);
  if (me.status === 401) {
    console.error("❌ Token inválido o expirado (401 de la Management API).");
    process.exit(1);
  }
  if (!me.ok) {
    console.error(`❌ No se pudo acceder al proyecto (${me.status}).`);
    process.exit(1);
  }
  const project = (await me.json()) as { name?: string };
  console.log(`✅ Proyecto: ${project.name ?? PROJECT_ID}`);

  // 1. Leer historial de migraciones aplicadas.
  const histRes = await mgmt(`/v1/projects/${PROJECT_ID}/database/migrations`);
  let applied = new Set<string>();
  if (histRes.ok) {
    const rows = (await histRes.json()) as MigrationRow[];
    applied = new Set(rows.map((r) => r.version));
  } else if (histRes.status !== 404) {
    console.error(`⚠️  No pude leer el historial de migraciones (${histRes.status}); continúo sin él.`);
  }

  // 2. Listar archivos locales en orden.
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    console.error("❌ No hay migraciones en supabase/migrations.");
    process.exit(1);
  }

  let appliedNow = 0;
  let skipped = 0;

  for (const file of files) {
    const version = file.replace(/\.sql$/, "").split("_")[0];
    const name = file.replace(/\.sql$/, "");
    const sql = readFileSync(join(dir, file), "utf8");

    if (applied.has(version) && !FORCE) {
      console.log(`  ⏭️  ${name} — ya aplicada, se salta`);
      skipped++;
      continue;
    }
    if (applied.has(version) && FORCE) {
      console.log(`  🔁 ${name} — re-ejecutando (prueba de idempotencia)…`);
    } else {
      console.log(`  ▶️  ${name} — aplicando…`);
    }

    // 3. Ejecutar el SQL vía el endpoint de query.
    const queryRes = await mgmt(`/v1/projects/${PROJECT_ID}/database/query`, {
      method: "POST",
      body: JSON.stringify({ query: sql }),
    });

    if (!queryRes.ok) {
      const body = await queryRes.text();
      console.error(`\n❌ FALLÓ ${name} (HTTP ${queryRes.status}):`);
      console.error(body.slice(0, 2000));
      console.error(
        `\n   Corrige el archivo y vuelve a correr pnpm db:migrate — las ya aplicadas se saltan.`
      );
      process.exit(1);
    }

    // 4. Registrar en el historial (mismo formato que supabase db push).
    if (!applied.has(version)) {
      const insertRes = await mgmt(`/v1/projects/${PROJECT_ID}/database/query`, {
        method: "POST",
        body: JSON.stringify({
          query: `insert into supabase_migrations.schema_migrations (version, name, statements)
                  values ('${version}', '${name.replace(/'/g, "''")}', null)
                  on conflict (version) do nothing;`,
        }),
      });
      if (!insertRes.ok) {
        console.error(`  ⚠️  ${name}: SQL aplicado pero no pude registrarlo en schema_migrations (${insertRes.status}).`);
      }
    }

    appliedNow++;
    console.log(`     ✅ OK`);
  }

  console.log(`\n✓ Migraciones: ${appliedNow} aplicadas, ${skipped} saltadas.\n`);
  if (FORCE) {
    console.log("   Todas se re-ejecutaron — la ausencia de errores valida la idempotencia.\n");
  }
}

main().catch((err) => {
  console.error("✗ db:migrate falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
