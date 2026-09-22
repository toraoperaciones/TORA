import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

import { QueryProvider } from "@/components/providers/query-provider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TORA — Infraestructura de viajes corporativos",
    template: "%s · TORA",
  },
  description:
    "Plataforma B2B multi-tenant para gestionar vuelos, hoteles, autos y stands de ferias con billetera pre-fondeada y CFDI consolidado.",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
  },
  openGraph: {
    title: "TORA — Infraestructura de viajes corporativos",
    description:
      "Vuelos, hoteles, autos y stands de ferias con billetera pre-fondeada y CFDI consolidado.",
    images: ["/brand/og.png"],
    type: "website",
  },
};

/**
 * Anti-flash: aplica el tema persistido ANTES de que React hidrate.
 * Dark es el default; si localStorage dice light, se aplica aquí mismo.
 */
const themeInit = `try{var t=localStorage.getItem("tora-theme");if(t==="light"){document.documentElement.classList.remove("dark")}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
