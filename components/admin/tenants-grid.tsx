"use client";

import { useMemo, useState } from "react";

import { TenantCard, type TenantRow } from "@/components/admin/tenant-card";
import { EmptySearch } from "@/components/illustrations/illustrations";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Activos" },
  { key: "onboarding", label: "Onboarding" },
  { key: "suspended", label: "Suspendidos" },
  { key: "archived", label: "Archivados" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

/** Grid de tenants: chips de filtro + búsqueda por nombre/RFC. */
export function TenantsGrid({ tenants }: { tenants: TenantRow[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.rfc ?? "").toLowerCase().includes(q)
      );
    });
  }, [tenants, filter, query]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Filtrar tenants"
          className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/50 p-1"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-8 rounded-md px-3 text-body-s transition-colors",
                filter === f.key
                  ? "bg-accent font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-64">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre o RFC…"
            aria-label="Buscar tenants"
            className="h-9 pl-3"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-14 text-center">
          <EmptySearch className="h-28 w-28" />
          <p className="text-body-s text-muted-foreground">
            Ningún tenant coincide con el filtro actual.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tenant) => (
            <TenantCard key={tenant.id} tenant={tenant} />
          ))}
        </div>
      )}
    </div>
  );
}
