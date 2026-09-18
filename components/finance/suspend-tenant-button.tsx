"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { suspendTenantAction } from "@/app/(finance)/finance/actions";

export function SuspendTenantButton({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSuspend() {
    setBusy(true);
    const result = await suspendTenantAction(tenantId);
    setBusy(false);

    if (!result.ok) {
      toast.error("No se pudo suspender", { description: result.error });
      return;
    }
    toast.success(`${tenantName} suspendido.`);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-display font-semibold">
          Suspender cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-h4 text-text-primary">
            Suspender a {tenantName}
          </DialogTitle>
          <DialogDescription className="text-body-s text-text-secondary">
            El cliente dejará de operar y su línea de crédito activa pasará a
            suspendida. Esta acción es manual y reversible desde ADMIN.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="font-display font-semibold"
          >
            Cancelar
          </Button>
          <Button onClick={handleSuspend} disabled={busy} className="font-display font-semibold">
            {busy ? "Suspendiendo…" : "Confirmar suspensión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
