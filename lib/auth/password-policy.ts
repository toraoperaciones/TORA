import { z } from "zod";

/**
 * Política de passwords TORA (Bloque 2/Bloque 4): 12+ chars, 4 clases de
 * carácter, y rechazo de las passwords más comunes (muestreo top ~1000 via
 * lista curada + patrones triviales). Fuente única: la usan /register,
 * /cambiar-password y el cambio post-rotación.
 */

/** Muestra del top de passwords filtradas (SplashData/SecLists top-1000). */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "123456", "12345678", "123456789",
  "1234567890", "qwerty", "qwerty123", "qwertyuiop", "abc123", "abc123456",
  "111111", "000000", "121212", "123123", "12341234", "112233", "654321",
  "admin", "admin123", "administrator", "letmein", "welcome", "welcome1",
  "monkey", "dragon", "master", "superman", "batman", "trustno1", "sunshine",
  "princess", "football", "baseball", "iloveyou", "whatever", "zaq12wsx",
  "qazwsx", "starwars", "shadow", "michael", "jennifer", "jordan", "hunter",
  "hunter2", "soccer", "harley", "ranger", "buster", "thomas", "tigger",
  "robert", "soccer1", "joshua", "freedom", "whatever1", "hello123",
  "toratora", "tora2025", "mexico1", "mexico2025", "monterrey", "guadalajara",
  "contra123", "contrasena", "contrasena123", "usuario123", "empresa123",
]);

const COMMON_SUBSTRINGS = [
  "qwerty", "123456", "password", "contrasena", "administra", "letmein",
  "iloveyou", "welcome1", "asdfgh", "zxcvbn",
];

export function isCommonPassword(pw: string): boolean {
  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (COMMON_SUBSTRINGS.some((s) => lower.includes(s))) return true;
  // Secuencias triviales de 5+ (abc..., 123..., teclado invertido).
  if (/(?:abcdefgh|abcdefg|hijklmn|012345678|12345678|23456789|987654|876543)/.test(lower)) {
    return true;
  }
  return false;
}

export const passwordSchema = z
  .string()
  .min(12, "Mínimo 12 caracteres")
  .regex(/[A-Z]/, "Debe incluir una mayúscula")
  .regex(/[a-z]/, "Debe incluir una minúscula")
  .regex(/[0-9]/, "Debe incluir un número")
  .regex(/[^A-Za-z0-9]/, "Debe incluir un símbolo")
  .refine((pw) => !isCommonPassword(pw), {
    message: "Es una contraseña demasiado común. Elige otra.",
  });

/** Mensaje de requisitos para mostrar bajo los inputs. */
export const PASSWORD_RULES_TEXT =
  "Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.";
