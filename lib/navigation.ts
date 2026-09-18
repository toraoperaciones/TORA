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

/**
 * Sección plana (portales con ≤4 items: agrupar sería ruido) o agrupada
 * (5+ items con agrupación natural: los overlines ayudan a escanear).
 */
export type NavSectionDef =
  | { type: "flat"; items: NavItemDef[] }
  | { type: "grouped"; groups: Array<{ label: string; items: NavItemDef[] }> };

/**
 * Dueño único del contenido del menú. Los labels NUNCA se truncan: el
 * sidebar colapsado muestra solo iconos con tooltip. Cambiar un label,
 * un orden o un icono cae aquí y se propaga a sidebar, sheet móvil y
 * command palette.
 */
export const NAV_BY_ROLE: Record<Role, NavSectionDef[]> = {
  CLIENT_ADMIN: [
    {
      type: "flat",
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
      type: "flat",
      items: [
        { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
        { href: "/invoices", label: "Facturas", icon: FileText },
        { href: "/trips", label: "Viajes", icon: Plane },
      ],
    },
  ],
  TORA_OPS: [
    {
      type: "flat",
      items: [
        { href: "/ops/inbox", label: "Bandeja", icon: Inbox },
        { href: "/ops/trips", label: "Viajes", icon: Plane },
        { href: "/ops/incidents", label: "Incidentes", icon: AlertCircle },
        { href: "/ops/clients", label: "Clientes", icon: Building2 },
      ],
    },
  ],
  TORA_FINANCE: [
    {
      type: "grouped",
      groups: [
        {
          label: "Finanzas",
          items: [
            { href: "/finance/deposits", label: "Depósitos SPEI", icon: Receipt },
            { href: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/finance/credit", label: "Líneas de crédito", icon: CreditCard },
            { href: "/finance/invoices", label: "Facturas", icon: FileText },
          ],
        },
      ],
    },
  ],
  TORA_ADMIN: [
    {
      type: "grouped",
      groups: [
        {
          label: "Administración",
          items: [
            { href: "/admin/tenants", label: "Tenants", icon: Building2 },
            { href: "/admin/users", label: "Usuarios", icon: Users },
            { href: "/admin/pipeline", label: "Pipeline", icon: Target },
            { href: "/admin/invoices", label: "Facturas", icon: FileText },
          ],
        },
        {
          label: "Operación",
          items: [
            { href: "/ops/inbox", label: "Bandeja Ops", icon: Inbox },
            { href: "/ops/incidents", label: "Incidentes", icon: AlertCircle },
          ],
        },
        {
          label: "Finanzas",
          items: [
            { href: "/finance/deposits", label: "Depósitos", icon: Receipt },
            { href: "/finance/dashboard", label: "Dashboard Fin.", icon: LayoutDashboard },
            { href: "/finance/credit", label: "Crédito", icon: CreditCard },
          ],
        },
      ],
    },
  ],
};
