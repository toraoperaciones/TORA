/**
 * Rota las passwords de TODOS los usuarios del seed.
 * - Genera 16 chars por usuario (mayús/minús/número/símbolo, sin ambiguos).
 * - Marca user_metadata.must_change_password = true.
 * - Imprime la tabla email + password nueva (el operador la guarda en el
 *   gestor de secretos; NUNCA se commitea).
 *
 * Uso: pnpm exec tsx scripts/rotate-passwords.ts
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !KEY) {
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

async function main() {
  const admin = createClient(URL, KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows: Array<{ email: string; password: string }> = [];

  for (const email of SEED_EMAILS) {
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (!user) {
      console.error(`✗ no encontrado: ${email}`);
      continue;
    }
    const password = generatePassword();
    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        must_change_password: true,
      },
    });
    if (updErr) {
      console.error(`✗ error ${email}: ${updErr.message}`);
      continue;
    }
    rows.push({ email, password });
    console.log(`✓ ${email}`);
  }

  console.log("\n=== CREDENCIALES NUEVAS (guardar en gestor de secretos) ===");
  for (const r of rows) {
    console.log(`${r.email}\t${r.password}`);
  }
}

main();
