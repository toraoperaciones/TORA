import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Layout de páginas legales públicas (aviso de privacidad, términos).
 * El matcher del middleware las deja pasar vía PUBLIC_PATHS.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
          >
            ← Volver
          </Link>
          <p className="text-xs uppercase tracking-wider text-foreground/60">
            TORA
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-foreground/60">
          <p>© {new Date().getFullYear()} TORA SA de CV. Todos los derechos reservados.</p>
          <nav className="flex gap-4">
            <Link href="/aviso-privacidad" className="hover:text-foreground">
              Aviso de privacidad
            </Link>
            <Link href="/terminos" className="hover:text-foreground">
              Términos y condiciones
            </Link>
            <a href="mailto:soporte@tora.mx" className="hover:text-foreground">
              soporte@tora.mx
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
