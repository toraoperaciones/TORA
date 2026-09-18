/**
 * Layout del grupo (auth): split con panel del preset (muted/accent) y radial depth.
 * Grupo de rutas — no afecta URLs (/login, /register, /pending).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-noise opacity-[0.03]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-radial-depth"
      />
      <div className="relative w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-3 duration-500 ease-[var(--ease-tora)]">
        {children}
      </div>
    </div>
  );
}
