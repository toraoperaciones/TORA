"use client";

import { ChevronsLeft, LogOut, PanelLeft, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import {
  NavSections,
  openPalette,
  useLogout,
} from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: Role;
  fullName: string;
  email: string;
  className?: string;
  /** Colapso forzado (rail de iconos en tablet 640–1024). */
  forcedCollapsed?: boolean;
}

/**
 * Sidebar de escritorio: 280px expandido, 72px colapsado (persistido).
 * Presentación only: los datos viven en lib/navigation.ts; el sheet móvil
 * en sidebar-sheet.tsx. El rail tablet reusa este componente con
 * forcedCollapsed.
 */
export function Sidebar({
  role,
  fullName,
  email,
  className,
  forcedCollapsed = false,
}: SidebarProps) {
  const pathname = usePathname();
  const { logout, loggingOut } = useLogout();
  const [collapsedState, setCollapsedState] = useState(false);
  const collapsed = forcedCollapsed || collapsedState;

  useEffect(() => {
    if (forcedCollapsed) return;
    try {
      setCollapsedState(localStorage.getItem("tora-sidebar") === "collapsed");
    } catch {
      // sin localStorage: expandido
    }
  }, [forcedCollapsed]);

  function toggleCollapse() {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tora-sidebar", next ? "collapsed" : "expanded");
        return next;
      } catch {
        // sin localStorage: no persistir
        return next;
      }
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-border-hairline bg-navy-deep text-text-primary transition-[width] duration-200 ease-[var(--ease-tora)]",
        collapsed ? "w-[72px]" : "w-[280px]",
        className
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-border-hairline",
          collapsed ? "justify-center px-2" : "justify-between px-5"
        )}
      >
        <Link href="/" aria-label="TORA" className="min-w-0">
          {collapsed ? (
            <Logo variant="symbol" theme="light" size="md" withWordmark={false} />
          ) : (
            <Logo variant="lockup" theme="light" size="md" />
          )}
        </Link>
        {!collapsed && !forcedCollapsed && (
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Colapsar menú"
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-layer-2 hover:text-text-primary"
          >
            <PanelLeft className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div
        className={cn(
          "border-b border-border-hairline py-4",
          collapsed ? "px-2" : "px-4"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 rounded-md",
            collapsed && "justify-center"
          )}
        >
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-layer-3 font-display text-caption font-semibold text-text-secondary"
          >
            {(fullName || "T").slice(0, 1).toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0" data-usercard>
              <span className="block truncate text-body-s font-semibold text-text-primary">
                {fullName || "Usuario"}
              </span>
              <span className="block truncate text-caption text-text-tertiary">
                {email}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <NavSections role={role} pathname={pathname} collapsed={collapsed} />
      </div>

      <div
        className={cn(
          "flex flex-col gap-1 border-t border-border-hairline p-3",
          collapsed && "items-center"
        )}
      >
        <button
          type="button"
          onClick={openPalette}
          title={collapsed ? "Buscar (⌘K)" : undefined}
          className={cn(
            "flex h-10 items-center gap-3 rounded-md px-3 text-body-s text-text-tertiary transition-colors hover:bg-layer-1 hover:text-text-primary",
            collapsed && "w-10 justify-center px-0"
          )}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          {!collapsed && (
            <>
              <span>Buscar</span>
              <kbd className="ml-auto rounded border border-border-subtle bg-layer-1 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                ⌘K
              </kbd>
            </>
          )}
        </button>

        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <NotificationBell
            canLinkTrips={role === "CLIENT_ADMIN" || role === "CLIENT_FINANCE"}
          />
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            title={collapsed ? "Cerrar sesión" : undefined}
            aria-label="Cerrar sesión"
            className={cn(
              "flex h-9 flex-1 items-center gap-3 rounded-md px-3 text-body-s text-text-tertiary transition-colors hover:bg-layer-1 hover:text-text-primary disabled:opacity-50",
              collapsed && "w-9 flex-none justify-center px-0"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            {!collapsed && (loggingOut ? "Cerrando sesión…" : "Cerrar sesión")}
          </button>
          {collapsed && !forcedCollapsed ? (
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Expandir menú"
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-layer-1 hover:text-text-primary"
            >
              <ChevronsLeft className="h-4 w-4 rotate-180" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
