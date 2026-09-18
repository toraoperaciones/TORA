import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Config compartido de Sentry: solo producción (dev/preview no queman cuota),
 * 10% de traces, y scrub de datos sensibles (emails, tokens, llaves, recibos).
 * El DSN es público por diseño (viaja en el bundle del cliente).
 */
export function sentryOptions() {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
    beforeSend(event: ErrorEvent, hint: EventHint) {
      // Nunca enviar PII: correos, llaves ni URLs de recibos/facturas.
      const strip = (u?: string) =>
        u?.replace(/(receipts|invoices)\/[^\s"?]+/g, "$1/[redacted]");
      if (event.request?.url) {
        event.request.url = strip(event.request.url);
      }
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.apikey;
        delete event.request.headers.cookie;
      }
      for (const value of event.exception?.values ?? []) {
        value.value = strip(value.value);
        if (value.stacktrace?.frames) {
          for (const frame of value.stacktrace.frames) {
            frame.filename = strip(frame.filename);
          }
        }
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  };
}
