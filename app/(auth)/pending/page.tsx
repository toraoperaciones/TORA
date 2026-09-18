import Link from "next/link";

import { Logo } from "@/components/brand/logo";

/**
 * Cuenta en revisión — destino de usuarios con status pending_approval.
 * Server Component estático; el middleware redirige aquí a quien no esté activo.
 */
export default function PendingPage() {
  return (
    <div className="flex flex-col items-center gap-6 border-border-subtle rounded-lg bg-navy-lift p-8 text-center shadow-sm">
      <Logo size="lg" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h2 text-text-primary">Cuenta en revisión</h1>
        <p className="prose-tora text-body-s text-text-secondary">
          Tu registro fue recibido. El equipo de TORA validará tu cuenta y te
          asignará un tenant. Recibirás un correo cuando esté activa.
        </p>
      </div>
      <Link
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-md bg-navy px-4 font-display text-body-s font-semibold text-offwhite transition-colors hover:bg-navy-hover"
      >
        Volver a inicio de sesión
      </Link>
    </div>
  );
}
