"use client";

import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import {
  NavSections,
  useLogout,
} from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { Role } from "@/lib/auth/roles";

interface SheetContentProps {
  role: Role;
  fullName: string;
  email: string;
  onNavigate?: () => void;
}

/**
 * Contenido del Sheet móvil. Comparte las piezas de sidebar-nav.tsx y los
 * mismos datos de lib/navigation.ts: un cambio de menú cae en un solo lugar.
 */
export function SidebarNavSheetContent({
  role,
  fullName,
  email,
  onNavigate,
}: SheetContentProps) {
  const pathname = usePathname();
  const { logout, loggingOut } = useLogout();

  return (
    <div className="flex h-full flex-col bg-navy-deep text-text-primary">
      <div className="flex h-16 items-center border-b border-border-hairline px-5">
        <Logo variant="lockup" theme="light" size="md" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-4 flex items-center gap-3 px-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-layer-3 font-display text-caption font-semibold text-text-secondary"
          >
            {(fullName || "T").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0" data-usercard>
            <span className="block truncate text-body-s font-semibold">
              {fullName || "Usuario"}
            </span>
            <span className="block truncate text-caption text-text-tertiary">
              {email}
            </span>
          </span>
        </div>
        <NavSections
          role={role}
          pathname={pathname}
          collapsed={false}
          onNavigate={onNavigate}
        />
      </div>
      <div className="flex items-center gap-2 border-t border-border-hairline p-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="flex h-9 flex-1 items-center gap-3 rounded-md px-3 text-body-s text-text-tertiary transition-colors hover:bg-layer-1 hover:text-text-primary disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </div>
  );
}
