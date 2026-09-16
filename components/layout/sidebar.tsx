"use client";

import {
  AlertCircle,
  Building2,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Plane,
  Receipt,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  role: Role;
  fullName: string;
  email: string;
}

interface NavItemDef {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_BY_ROLE: Record<Role, NavItemDef[]> = {
  CLIENT_ADMIN: [
    { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
    { href: "/wallet", label: "Billetera", icon: Wallet },
    { href: "/trips", label: "Viajes", icon: Plane },
    { href: "/invoices", label: "Facturas", icon: FileText },
  ],
  CLIENT_FINANCE: [
    { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
    { href: "/invoices", label: "Facturas", icon: FileText },
    { href: "/trips", label: "Viajes", icon: Plane },
  ],
  TORA_OPS: [
    { href: "/ops/inbox", label: "Bandeja", icon: Inbox },
    { href: "/ops/trips", label: "Viajes", icon: Plane },
    { href: "/ops/incidents", label: "Incidentes", icon: AlertCircle },
    { href: "/ops/clients", label: "Clientes", icon: Building2 },
  ],
  TORA_ADMIN: [
    { href: "/admin/tenants", label: "Tenants", icon: Building2 },
    { href: "/admin/users", label: "Usuarios", icon: Users },
    { href: "/admin/pipeline", label: "Pipeline", icon: Target },
    { href: "/admin/invoices", label: "Facturas", icon: FileText },
    { href: "/ops/inbox", label: "Bandeja Ops", icon: Inbox },
    { href: "/ops/incidents", label: "Incidentes", icon: AlertCircle },
    { href: "/finance/deposits", label: "Depósitos", icon: Receipt },
    { href: "/finance/dashboard", label: "Dashboard Fin.", icon: LayoutDashboard },
    { href: "/finance/credit", label: "Crédito", icon: CreditCard },
  ],
  TORA_FINANCE: [
    { href: "/finance/deposits", label: "Depósitos SPEI", icon: Receipt },
    { href: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/finance/credit", label: "Líneas de crédito", icon: CreditCard },
    { href: "/finance/invoices", label: "Facturas", icon: FileText },
  ],
};

function NavItem({ item, active }: { item: NavItemDef; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-body-s transition-colors",
        active
          ? "bg-offwhite/10 font-semibold text-offwhite"
          : "text-offwhite/70 hover:bg-offwhite/6 hover:text-offwhite"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar({ role, fullName, email }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const items = NAV_BY_ROLE[role];

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-navy p-6 text-offwhite">
      <div className="mb-6 flex h-10 items-center">
        <Logo variant="inverse" size="md" />
      </div>

      <nav className="flex flex-col gap-1" aria-label={role}>
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return <NavItem key={item.href} item={item} active={active} />;
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-offwhite/10 pt-4">
        <div className="flex flex-col px-3">
          <span className="text-body-s font-semibold">
            {fullName || "Usuario"}
          </span>
          <span className="text-caption text-offwhite/60">{email}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex h-10 items-center gap-3 rounded-md px-3 text-body-s text-offwhite/70 transition-colors hover:bg-offwhite/6 hover:text-offwhite disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}
