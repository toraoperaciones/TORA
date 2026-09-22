import type { Metadata } from "next";

import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Cambia tu contraseña · TORA" };

/**
 * Cambio de contraseña post-rotación (must_change_password=true) y
 * auto-servicio general. Página pública: el gate de middleware decide
 * quién llega aquí.
 */
export default function CambiarPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-8">
      <ChangePasswordForm />
    </div>
  );
}
