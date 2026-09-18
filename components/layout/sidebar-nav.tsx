"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NAV_BY_ROLE, type NavItemDef } from "@/lib/navigation";
import type { Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Piezas de navegación compartidas por las tres variantes de shell
 * (sidebar desktop, rail tablet, sheet móvil). Un cambio de menú cae
 * en lib/navigation.ts; un cambio de presentación de item, aquí.
 */

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavItem({
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
        "relative flex h-11 items-center gap-3 rounded-md px-3 text-body-s font-medium whitespace-nowrap transition-colors duration-150 md:h-10",
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

export function NavSections({
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
    <nav
      className="flex flex-col gap-1"
      aria-label="Navegación principal"
    >
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

export function useLogout() {
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

export function openPalette() {
  window.dispatchEvent(new CustomEvent("tora:open-palette"));
}
