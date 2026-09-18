"use client";

import { Menu } from "lucide-react";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CommandPalette } from "@/components/layout/command-palette";
import { Logo } from "@/components/brand/logo";
import { Sidebar, SidebarNavSheetContent } from "@/components/layout/sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Role } from "@/lib/auth/roles";
import { EASE_TORA } from "@/lib/motion";

interface PortalShellProps {
  role: Role;
  fullName: string;
  email: string;
  children: React.ReactNode;
}

/**
 * Shell de portal — sidebar navy en desktop, Sheet + topbar en móvil.
 * El contenido entra con fade + slide de 200ms por navegación.
 */
export function PortalShell({
  role,
  fullName,
  email,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-navy-deep">
      <Sidebar
        role={role}
        fullName={fullName}
        email={email}
        className="hidden lg:flex"
      />

      {/* Topbar móvil */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border-hairline bg-navy-deep px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-layer-2 hover:text-text-primary"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <Logo variant="inverse" size="sm" />
        <span className="h-5 w-5" aria-hidden />
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
 className="w-[280px] max-w-[85vw] gap-0 border-border-hairline p-0"
        >
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SidebarNavSheetContent
            role={role}
            fullName={fullName}
 email={email}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <CommandPalette role={role} />

      <main className="min-w-0 flex-1 pt-14 lg:pt-0">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE_TORA }}
        >
          <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-6 lg:px-16">
            {children}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
