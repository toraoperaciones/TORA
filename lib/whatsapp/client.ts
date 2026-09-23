import "server-only";

/**
 * Cliente WAHA (WhatsApp HTTP API desplegado en Railway).
 *
 * Regla de degradación: si WAHA no está configurado o falla (timeout, red,
 * 5xx), el envío se salta en silencio — la notificación in-app (tabla
 * notifications) es el respaldo y el flujo de negocio NUNCA se rompe.
 */

const TIMEOUT_MS = 10_000;

export interface SendWhatsAppResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
}

/** Normaliza a chatId de WAHA: "+52 1 55 1234 5678" → "5215512345678@c.us". */
export function toChatId(phone: string): string {
  return `${phone.replace(/[+\s()-]/g, "")}@c.us`;
}

/** WAHA configurado (env vars presentes). La sesión puede seguir caída. */
export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WAHA_API_URL &&
      process.env.WAHA_API_KEY &&
      process.env.WAHA_SESSION_NAME,
  );
}

export async function sendWhatsAppMessage(
  phone: string,
  text: string,
): Promise<SendWhatsAppResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, skipped: true, reason: "not_configured" };
  }

  const url = `${process.env.WAHA_API_URL}/api/sendText`;
  const body = JSON.stringify({
    session: process.env.WAHA_SESSION_NAME,
    chatId: toChatId(phone),
    text,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.WAHA_API_KEY!,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error("[whatsapp] WAHA respondió", res.status);
      return { ok: false, error: `waha_http_${res.status}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, messageId: data.id };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "TimeoutError" ? "timeout" : "network";
    console.error(`[whatsapp] envío fallido (${reason})`);
    return { ok: false, error: reason };
  }
}
