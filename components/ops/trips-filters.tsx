"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TenantOption {
  id: string;
  name: string;
}

const STATUS_FILTERS = [
  { value: "all", label: "Todos activos" },
  { value: "awaiting_selection", label: "Esperando selección" },
  { value: "awaiting_payment", label: "Pendiente de pago" },
  { value: "confirmed", label: "Confirmados" },
  { value: "completed", label: "Completados" },
] as const;

export function TripsFilters({ tenants }: { tenants: TenantOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [tenant, setTenant] = useState(searchParams.get("tenant") ?? "all");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");

  function apply(next: { status?: string; tenant?: string; from?: string; to?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const merged = { status, tenant, from, to, ...next };

    const setOrDelete = (key: string, value: string, isDefault: boolean) => {
      if (!value || isDefault) params.delete(key);
      else params.set(key, value);
    };
    setOrDelete("status", merged.status, merged.status === "all");
    setOrDelete("tenant", merged.tenant, merged.tenant === "all");
    setOrDelete("from", merged.from, false);
    setOrDelete("to", merged.to, false);
    params.delete("page"); // reset paginación al filtrar

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-status">Estado</Label>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            apply({ status: value });
          }}
        >
          <SelectTrigger id="filter-status" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-tenant">Cliente</Label>
        <Select
          value={tenant}
          onValueChange={(value) => {
            setTenant(value);
            apply({ tenant: value });
          }}
        >
          <SelectTrigger id="filter-tenant" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-from">Salida desde</Label>
        <Input
          id="filter-from"
          type="date"
          className="w-40"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            apply({ from: e.target.value });
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-to">Salida hasta</Label>
        <Input
          id="filter-to"
          type="date"
          className="w-40"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            apply({ to: e.target.value });
          }}
        />
      </div>

      {(status !== "all" || tenant !== "all" || from || to) && (
        <Button
          variant="ghost"
          className="font-display font-semibold"
          onClick={() => {
            setStatus("all");
            setTenant("all");
            setFrom("");
            setTo("");
            router.push(pathname);
          }}
        >
          Limpiar
        </Button>
      )}
    </div>
  );
}
