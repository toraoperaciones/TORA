import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
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

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
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
    <html lang="es-MX" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrains.variable} bg-background font-body text-foreground antialiased`}
      >
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
