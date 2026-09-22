import type { RemixiconComponentType } from "@remixicon/react";
import {
  RiBankCardLine,
  RiBuildingLine,
  RiDashboardLine,
  RiErrorWarningLine,
  RiFileTextLine,
  RiFlightTakeoffLine,
  RiFocus3Line,
  RiInboxLine,
  RiReceiptLine,
  RiTeamLine,
  RiWalletLine,
} from "@remixicon/react";

import type { Role } from "@/lib/auth/roles";

export interface NavItemDef {
  href: string;
  label: string;
  icon: RemixiconComponentType;
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
        { href: "/dashboard", label: "Inicio", icon: RiDashboardLine },
        { href: "/trips", label: "Viajes", icon: RiFlightTakeoffLine },
        { href: "/wallet", label: "Billetera", icon: RiWalletLine },
        { href: "/invoices", label: "Facturas", icon: RiFileTextLine },
      ],
    },
  ],
  CLIENT_FINANCE: [
    {
      type: "flat",
      items: [
        { href: "/dashboard", label: "Inicio", icon: RiDashboardLine },
        { href: "/invoices", label: "Facturas", icon: RiFileTextLine },
        { href: "/trips", label: "Viajes", icon: RiFlightTakeoffLine },
      ],
    },
  ],
  TORA_OPS: [
    {
      type: "flat",
      items: [
        { href: "/ops/inbox", label: "Bandeja", icon: RiInboxLine },
        { href: "/ops/trips", label: "Viajes", icon: RiFlightTakeoffLine },
        { href: "/ops/incidents", label: "Incidentes", icon: RiErrorWarningLine },
        { href: "/ops/clients", label: "Clientes", icon: RiBuildingLine },
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
            { href: "/finance/deposits", label: "Depósitos SPEI", icon: RiReceiptLine },
            { href: "/finance/dashboard", label: "Dashboard", icon: RiDashboardLine },
            { href: "/finance/credit", label: "Líneas de crédito", icon: RiBankCardLine },
            { href: "/finance/invoices", label: "Facturas", icon: RiFileTextLine },
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
            { href: "/admin/tenants", label: "Tenants", icon: RiBuildingLine },
            { href: "/admin/users", label: "Usuarios", icon: RiTeamLine },
            { href: "/admin/pipeline", label: "Pipeline", icon: RiFocus3Line },
            { href: "/admin/invoices", label: "Facturas", icon: RiFileTextLine },
          ],
        },
        {
          label: "Operación",
          items: [
            { href: "/ops/inbox", label: "Bandeja Ops", icon: RiInboxLine },
            { href: "/ops/incidents", label: "Incidentes", icon: RiErrorWarningLine },
          ],
        },
        {
          label: "Finanzas",
          items: [
            { href: "/finance/deposits", label: "Depósitos", icon: RiReceiptLine },
            { href: "/finance/dashboard", label: "Dashboard Fin.", icon: RiDashboardLine },
            { href: "/finance/credit", label: "Crédito", icon: RiBankCardLine },
          ],
        },
      ],
    },
  ],
};
