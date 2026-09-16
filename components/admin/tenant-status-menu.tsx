"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toggleTenantStatusAction } from "@/app/(admin)/admin/tenants/actions";

const LABELS: Record<string, string> = {
  active: "Activar",
  suspended: "Suspender",
  archived: "Archivar",
};

export function TenantStatusMenu({
  tenantId,
  status: currentStatus,
}: {
  tenantId: string;
  status: string;
}) {
  const [confirm, setConfirm] = useState<"active" | "suspended" | "archived" | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!confirm) return;
    setSaving(true);
    const result = await toggleTenantStatusAction(tenantId, confirm);
    setSaving(false);
    if (!result.ok) {
      toast.error("No se pudo cambiar el estado", { description: result.error });
      return;
    }
    toast.success(`Tenant ${LABELS[confirm].toLowerCase()}do.`);
    setConfirm(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(currentStatus === "suspended" ? "active" : "suspended")}
        aria-label={currentStatus === "suspended" ? "Activar tenant" : "Suspender tenant"}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-graphite transition-colors hover:bg-navy/5"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      </button>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-h4 text-navy">
              {confirm ? LABELS[confirm] : ""} tenant
            </DialogTitle>
            <DialogDescription className="text-body-s text-graphite">
              Esta acción cambia el estado del tenant. Los usuarios del tenant seguirán
              pudiendo iniciar sesión; el bloqueo por suspensión se aplica en el portal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} className="font-display font-semibold">
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={saving} className="font-display font-semibold">
              {saving ? "Aplicando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
