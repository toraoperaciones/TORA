import Link from "next/link";

import { Logo } from "@/components/brand/logo";

/**
 * Cuenta en revisión — destino de usuarios con status pending_approval.
 * Server Component estático; el middleware redirige aquí a quien no esté activo.
 */
export default function PendingPage() {
  return (
    <div className="flex flex-col items-center gap-6 border-border rounded-lg bg-card p-8 text-center shadow-sm">
      <Logo variant="lockup" theme="light" size="lg" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Cuenta en revisión</h1>
        <p className="max-w-[75ch] text-sm text-foreground/75">
          Tu registro fue recibido. El equipo de TORA validará tu cuenta y te
          asignará un tenant. Recibirás un correo cuando esté activa.
        </p>
      </div>
      <Link
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-md bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
      >
        Volver a inicio de sesión
      </Link>
    </div>
  );
}
