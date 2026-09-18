"use client";

import {
  AlertCircle,
  Building2,
  ChevronsLeft,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Plane,
  Receipt,
  Search,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  role: Role;
  fullName: string;
  email: string;
  className?: string;
}

interface NavItemDef {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavSectionDef {
  overline: string;
  items: NavItemDef[];
}

/**
 * Navegación agrupada por sección. Los labels NUNCA se truncan:
 * el sidebar colapsado muestra solo iconos con tooltip.
 */
export const NAV_BY_ROLE: Record<Role, NavSectionDef[]> = {
  CLIENT_ADMIN: [
    {
      overline: "Operación",
      items: [
        { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
        { href: "/trips", label: "Viajes", icon: Plane },
        { href: "/wallet", label: "Billetera", icon: Wallet },
        { href: "/invoices", label: "Facturas", icon: FileText },
      ],
    },
  ],
  CLIENT_FINANCE: [
    {
      overline: "Operación",
      items: [
        { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
        { href: "/invoices", label: "Facturas", icon: FileText },
        { href: "/trips", label: "Viajes", icon: Plane },
      ],
    },
  ],
  TORA_OPS: [
    {
      overline: "Operación",
      items: [
        { href: "/ops/inbox", label: "Bandeja", icon: Inbox },
        { href: "/ops/trips", label: "Viajes", icon: Plane },
        { href: "/ops/incidents", label: "Incidentes", icon: AlertCircle },
        { href: "/ops/clients", label: "Clientes", icon: Building2 },
      ],
    },
  ],
  TORA_ADMIN: [
    {
      overline: "Operación",
      items: [
        { href: "/ops/inbox", label: "Bandeja Ops", icon: Inbox },
        { href: "/ops/incidents", label: "Incidentes", icon: AlertCircle },
      ],
    },
    {
      overline: "Finanzas",
      items: [
        { href: "/finance/deposits", label: "Depósitos", icon: Receipt },
        { href: "/finance/credit", label: "Crédito", icon: CreditCard },
        { href: "/finance/dashboard", label: "Dashboard Fin.", icon: LayoutDashboard },
      ],
    },
    {
      overline: "Administración",
      items: [
        { href: "/admin/tenants", label: "Tenants", icon: Building2 },
        { href: "/admin/users", label: "Usuarios", icon: Users },
        { href: "/admin/pipeline", label: "Pipeline", icon: Target },
        { href: "/admin/invoices", label: "Facturas", icon: FileText },
      ],
    },
  ],
  TORA_FINANCE: [
    {
      overline: "Finanzas",
      items: [
        { href: "/finance/deposits", label: "Depósitos SPEI", icon: Receipt },
        { href: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/finance/credit", label: "Líneas de crédito", icon: CreditCard },
        { href: "/finance/invoices", label: "Facturas", icon: FileText },
      ],
    },
  ],
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavItem({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItemDef;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-md px-3 text-body-s font-medium whitespace-nowrap transition-colors duration-150",
        collapsed && "justify-center px-0",
        active
          ? "bg-layer-3 text-text-primary"
          : "text-text-tertiary hover:bg-layer-1 hover:text-text-primary"
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 h-4 w-[3px] rounded-full bg-forest"
        />
      )}
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function NavSections({
  role,
  pathname,
  collapsed,
  onNavigate,
}: {
  role: Role;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const sections = NAV_BY_ROLE[role];
  return (
    <nav className="flex flex-col gap-1" aria-label={`Navegación ${role}`}>
      {sections.map((section, si) => (
        <div key={section.overline} className={cn(si > 0 && "mt-5")}>
          {!collapsed && (
            <p className="mb-2 px-3 text-overline uppercase tracking-wider text-text-muted">
              {section.overline}
            </p>
          )}
          {collapsed && si > 0 && <div className="mx-3 mb-3 border-t border-border-hairline" />}
          <div className="flex flex-col gap-1">
            {section.items.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function useLogout() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return { logout, loggingOut };
}

function openPalette() {
  window.dispatchEvent(new CustomEvent("tora:open-palette"));
}

/** Sidebar de escritorio: 280px expandido, 72px colapsado (persistido). */
export function Sidebar({ role, fullName, email, className }: SidebarProps) {
  const pathname = usePathname();
  const { logout, loggingOut } = useLogout();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("tora-sidebar") === "collapsed");
    } catch {
      // sin localStorage: expandido
    }
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tora-sidebar", next ? "collapsed" : "expanded");
      } catch {
        // noop
      }
      return next;
    });
  }

  return (    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-border-hairline bg-navy-deep text-text-primary transition-[width] duration-200 ease-[var(--ease-tora)]",
        collapsed ? "w-[72px]" : "w-[280px]",
        className
      )
    }
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-border-hairline",
          collapsed ? "justify-center px-2" : "justify-between px-5"
        )}
      >
        <Link href="/" aria-label="TORA" className="min-w-0">
          <Logo variant="inverse" size="md" withWordmark={!collapsed} />
        </Link>
        {!collapsed && (
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
            <span className="min-w-0">
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
          {collapsed ? (
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

/** Contenido de navegación para el Sheet móvil (comparte la misma defs). */
export function SidebarNavSheetContent({
  role,
  fullName,
  email,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { logout, loggingOut } = useLogout();

  return (
    <div className="flex h-full flex-col bg-navy-deep text-text-primary">
      <div className="flex h-16 items-center border-b border-border-hairline px-5">
        <Logo variant="inverse" size="md" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-4 flex items-center gap-3 px-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-layer-3 font-display text-caption font-semibold text-text-secondary"
          >
            {(fullName || "T").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
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
