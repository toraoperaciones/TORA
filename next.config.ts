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
  disableLogger: true,
  // No enviar telemetría del propio build a Sentry.
  telemetry: false,
});
