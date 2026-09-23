import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import "server-only";

/**
 * Cifrado AES-256-GCM para los archivos del CSD (cer/key/password) de las
 * empresas emisoras. La llave vive SOLO en ENCRYPTION_KEY (hex de 32 bytes,
 * generado con `openssl rand -hex 32`); jamás se loguea ni se imprime.
 *
 * Formato del payload cifrado: base64(iv[12] || authTag[16] || ciphertext).
 * La derivación usa SHA-256 del valor para normalizar a 32 bytes: acepta el
 * hex directo de `openssl rand -hex 32` o una passphrase larga equivalente.
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "[crypto] ENCRYPTION_KEY no está configurada (generar con `openssl rand -hex 32`)."
    );
  }
  if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return createHash("sha256").update(raw).digest();
}

/** La app puede mostrar un aviso de configuración sin explotar. */
export function isEncryptionConfigured(): boolean {
  const raw = process.env.ENCRYPTION_KEY;
  return typeof raw === "string" && raw.length >= 32;
}

/** Cifra un string a base64(iv || authTag || ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

/**
 * Descifra el payload de encryptSecret. Lanza si el payload fue alterado
 * (auth tag GCM) o si la llave no corresponde.
 */
export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length <= IV_BYTES + TAG_BYTES) {
    throw new Error("[crypto] payload cifrado inválido");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const data = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}
