import {
  AlertCircle,
  Building2,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  Plane,
  Receipt,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/auth/roles";

export interface NavItemDef {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSectionDef {
  overline: string;
  items: NavItemDef[];
}

/**
 * Navegación agrupada por sección (spec A2). Los labels NUNCA se truncan:
 * el sidebar colapsado muestra solo iconos. Orden dentro de cada sección:
 * frecuencia de uso, lo más usado arriba.
 *
 * Dueño único del contenido del menú: cambiar un label, un orden o un icono
 * cae aquí y se propaga a sidebar desktop, rail tablet y sheet móvil.
 */
export const NAV_BY_ROLE: Record<Role, NavSectionDef[]> = {
  CLIENT_ADMIN: [
    {
      overline: "Operación",
      items: [
        { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
        { href: "/trips", label: "Viajes", icon: Plane },
        { href: "/wallet", label: "Billetera", icon: Wallet },
      ],
    },
    {
      overline: "Gestión",
      items: [{ href: "/invoices", label: "Facturas", icon: FileText }],
    },
  ],
  CLIENT_FINANCE: [
    {
      overline: "Finanzas",
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
      overline: "Administración",
      items: [
        { href: "/admin/tenants", label: "Tenants", icon: Building2 },
        { href: "/admin/users", label: "Usuarios", icon: Users },
        { href: "/admin/pipeline", label: "Pipeline", icon: Target },
        { href: "/admin/invoices", label: "Facturas", icon: FileText },
      ],
    },
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
        { href: "/finance/dashboard", label: "Dashboard Fin.", icon: LayoutDashboard },
        { href: "/finance/credit", label: "Crédito", icon: CreditCard },
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
