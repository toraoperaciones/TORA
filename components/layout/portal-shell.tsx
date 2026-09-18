import { cookies } from "next/headers";

import { CommandPalette } from "@/components/layout/command-palette";
import { Logo } from "@/components/brand/logo";
import { PortalSidebar } from "@/components/layout/sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { Role } from "@/lib/auth/roles";

interface PortalShellProps {
  role: Role;
  fullName: string;
  email: string;
  children: React.ReactNode;
}

/**
 * Shell de portal con primitivas de shadcn. Server Component: lee la
 * cookie sidebar_state para hidratar el colapso sin flash (patrón
 * oficial sidebar-07). El Sidebar colapsa a iconos (⌘B, rail, trigger).
 */
export async function PortalShell({
  role,
  fullName,
  email,
  children,
}: PortalShellProps) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <PortalSidebar role={role} fullName={fullName} email={email} />
      <SidebarInset>
        <ShellTopbar />
        <div className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-6 lg:px-16 2xl:px-24">
          {children}
        </div>
      </SidebarInset>
      <CommandPalette role={role} />
    </SidebarProvider>
  );
}

/**
 * Topbar con trigger del sidebar (patrón sidebar-07): visible en todos
 * los viewports, sticky en móvil.
 */
function ShellTopbar() {
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-border bg-background px-4">
      <SidebarTrigger aria-label="Alternar menú" />
      <Logo variant="lockup" theme="dark" size="sm" className="dark:invert" />
    </header>
  );
}
