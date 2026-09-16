import { Sidebar } from "@/components/layout/sidebar";
import type { Role } from "@/lib/auth/roles";

interface PortalShellProps {
  role: Role;
  fullName: string;
  email: string;
  children: React.ReactNode;
}

/**
 * Shell de portal: sidebar Navy (240px) + contenido centrado a 1280px.
 * Server Component — la interactividad vive dentro de Sidebar.
 */
export function PortalShell({
  role,
  fullName,
  email,
  children,
}: PortalShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} fullName={fullName} email={email} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1280px] px-6 py-8 lg:px-16">
          {children}
        </div>
      </main>
    </div>
  );
}
