"use client";

import { RiLogoutBoxLine, RiSearchLine } from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import {
  NavSections,
  openPalette,
  useLogout,
} from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { Role } from "@/lib/auth/roles";

/**
 * Sidebar de portal (primitivas de shadcn): colapsa a iconos con
 * tooltip (⌘B, estado persistido en cookie por SidebarProvider).
 * Presentación only: los datos viven en lib/navigation.ts; el sheet
 * móvil es el mismo Sidebar renderizado como Sheet por la primitiva.
 */
export function PortalSidebar({
  role,
  fullName,
  email,
}: {
  role: Role;
  fullName: string;
  email: string;
}) {
  const pathname = usePathname();
  const { logout, loggingOut } = useLogout();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="TORA">
              <Link href="/" aria-label="TORA — inicio" className="flex items-center gap-2">
                {/* Símbolo solo en modo colapsado; lockup en expandido.
                    PNG negro + invert en dark: visible en ambos temas. */}
                <Logo
                  variant="symbol"
                  theme="dark"
                  size="md"
                  withWordmark={false}
                  className="hidden size-7 justify-center group-data-[collapsible=icon]:flex dark:invert"
                />
                <Logo
                  variant="lockup"
                  theme="dark"
                  size="md"
                  className="group-data-[collapsible=icon]:hidden dark:invert"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavSections role={role} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={fullName || "Usuario"}>
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground/75"
              >
                {(fullName || "T").slice(0, 1).toUpperCase()}
              </span>
              <span className="grid flex-1 leading-tight" data-usercard>
                <span className="truncate text-sm font-semibold">
                  {fullName || "Usuario"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Buscar (⌘K)"
              onClick={openPalette}
              className="text-sm text-muted-foreground"
            >
              <RiSearchLine aria-hidden />
              <span>Buscar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
              onClick={logout}
              disabled={loggingOut}
              className="text-sm text-muted-foreground"
            >
              <RiLogoutBoxLine aria-hidden />
              <span>{loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center gap-1 px-2 pb-1 group-data-[collapsible=icon]:justify-center">
          <NotificationBell
            canLinkTrips={role === "CLIENT_ADMIN" || role === "CLIENT_FINANCE"}
          />
          <ThemeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
