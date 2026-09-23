"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { exportInvoiceJsonAction } from "@/app/(admin)/admin/invoices/actions";

interface TenantOption {
  id: string;
  name: string;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * "Descargar JSON para timbrado": arma el payload CFDI del período y lo
 * descarga como factura-{slug}-{periodo}.json para enviarlo al contador.
 */
export function InvoiceExportDialog({ tenants }: { tenants: TenantOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [period, setPeriod] = useState(currentPeriod());
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (!tenantId) {
      toast.error("Selecciona un cliente");
      return;
    }
    setBusy(true);
    const result = await exportInvoiceJsonAction(tenantId, period.trim());
    setBusy(false);

    if (!result.ok) {
      toast.error("No se pudo generar el JSON", { description: result.error });
      return;
    }

    const tenant = tenants.find((t) => t.id === tenantId);
    const slug = (tenant?.name ?? "tenant")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const blob = new Blob([result.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `factura-${slug}-${period}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("JSON generado. Envíalo al contador para timbrar.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-semibold">
          Descargar JSON para timbrado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export JSON para timbrado</DialogTitle>
          <DialogDescription>
            Genera el payload CFDI 4.0 del período para que el contador lo suba
            al PAC. El JSON agrupa todos los viajes con salida en ese mes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="export-tenant">Cliente</Label>
            <select
              id="export-tenant"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="export-period">Período</Label>
            <Input
              id="export-period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleExport} disabled={busy} className="font-semibold">
            {busy ? "Generando…" : "Generar y descargar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
