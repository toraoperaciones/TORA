import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";

import { QueryProvider } from "@/components/providers/query-provider";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TORA — Infraestructura de viajes corporativos",
  description:
    "Plataforma B2B multi-tenant para gestionar vuelos, hoteles, autos y stands de ferias con billetera pre-fondeada y CFDI consolidado.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} bg-offwhite font-body text-navy antialiased`}
      >
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
