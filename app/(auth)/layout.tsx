/**
 * Layout del grupo (auth): centrado limpio sobre el fondo del preset.
 * Grupo de rutas — no afecta URLs (/login, /register, /pending).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-8">
      <div className="w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-3 duration-500 ease-out">
        {children}
      </div>
    </div>
  );
}
