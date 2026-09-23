import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // El token solo existe en CI/Vercel: sin él, build local no sube sourcemaps.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Mostrar progreso de subida de sourcemaps solo cuando hay token.
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // SENTRY_DEBUG=1 conserva el logger del SDK para diagnosticar el pipeline
  // (el build de producción normal va sin logging).
  disableLogger: process.env.SENTRY_DEBUG !== "1",
  // No enviar telemetría del propio build a Sentry.
  telemetry: false,
});
