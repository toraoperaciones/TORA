/**
 * Rota las passwords de TODOS los usuarios del seed.
 * - Genera 16 chars por usuario (mayús/minús/número/símbolo, sin ambiguos).
 * - Marca user_metadata.must_change_password = true.
 * - Imprime la tabla email + password nueva (el operador la guarda en el
 *   gestor de secretos; NUNCA se commitea).
 *
 * Usa la Admin API de GoTrue vía fetch (sin supabase-js: su realtime
 * requiere WebSocket nativo de Node 22; el script corre en Node 20).
 *
 * Uso: pnpm exec tsx scripts/rotate-passwords.ts
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const SEED_EMAILS = [
  "admin@tora.mx",
  "ops@tora.mx",
  "finanzas@tora.mx",
  "admin@aceronorte.mx",
  "finanzas@aceronorte.mx",
  "admin@vcm.mx",
  "finanzas@vcm.mx",
];

// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) para lectura humana.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*+?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function generatePassword(length = 16): string {
  const crypto = globalThis.crypto;
  const pick = (alphabet: string) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return alphabet[buf[0] % alphabet.length];
  };
  // Garantiza al menos uno de cada clase.
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Fisher-Yates con randomness criptográfico.
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${URL_BASE}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${KEY!}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

interface GoTrueUser {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
}

async function main() {
  const listRes = await adminFetch("/admin/users?per_page=200");
  if (!listRes.ok) {
    console.error(`✗ No pude listar usuarios (HTTP ${listRes.status})`);
    process.exit(1);
  }
  const { users } = (await listRes.json()) as { users: GoTrueUser[] };
  const byEmail = new Map(users.map((u) => [u.email, u]));

  const rows: Array<{ email: string; password: string }> = [];

  for (const email of SEED_EMAILS) {
    const user = byEmail.get(email);
    if (!user) {
      console.error(`✗ no encontrado: ${email}`);
      continue;
    }
    const password = generatePassword();
    const updRes = await adminFetch(`/admin/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({
        password,
        user_metadata: {
          ...(user.user_metadata ?? {}),
          must_change_password: true,
        },
      }),
    });
    if (!updRes.ok) {
      console.error(`✗ error ${email}: HTTP ${updRes.status}`);
      continue;
    }
    rows.push({ email, password });
    console.log(`✓ ${email}`);
  }

  console.log("\n=== CREDENCIALES NUEVAS (guardar en gestor de secretos) ===");
  for (const r of rows) {
    console.log(`${r.email}\t${r.password}`);
  }
  if (rows.length !== SEED_EMAILS.length) {
    process.exit(1);
  }
}

main();
