"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NAV_BY_ROLE, type NavItemDef } from "@/lib/navigation";
import type { Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

/**
 * Piezas de navegación compartidas por el sidebar y el sheet móvil.
 * Los datos viven en lib/navigation.ts (flat|grouped); la presentación
 * de item, aquí.
 */

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavRow({
  item,
  active,
  onNavigate,
}: {
  item: NavItemDef;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className="h-9 gap-2.5 text-sm"
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
        >
          <Icon className="shrink-0" aria-hidden />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function NavSections({
  role,
  pathname,
  onNavigate,
}: {
  role: Role;
  pathname: string;
  onNavigate?: () => void;
}) {
  const sections = NAV_BY_ROLE[role];
  return (
    <nav
      className="flex flex-col gap-4"
      aria-label="Navegación principal"
    >
      {sections.map((section) =>
        section.type === "flat" ? (
          <SidebarGroup key={`flat-${section.items[0]?.href}`}>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <NavRow
                    key={item.href}
                    item={item}
                    active={isActive(pathname, item.href)}
                    onNavigate={onNavigate}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          section.groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <NavRow
                      key={item.href}
                      item={item}
                      active={isActive(pathname, item.href)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )
      )}
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
