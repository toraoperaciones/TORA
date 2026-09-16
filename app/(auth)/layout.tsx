/**
 * Layout del grupo (auth): centra el contenido en pantalla.
 * Grupo de rutas — no afecta URLs (/login, /register, /pending).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-offwhite px-6 py-8">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
