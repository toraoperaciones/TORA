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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settleCreditTripAction } from "@/app/(finance)/finance/actions";
import { formatMXN } from "@/lib/utils";

/**
 * Liquidar un trip a crédito: registra el pago con su referencia y
 * settle_credit_trip baja credit_used y marca la factura interna pagada.
 */
export function SettleCreditDialog({
  tripId,
  tenantName,
  destination,
  amount,
  dueDate,
  daysOverdue,
  trigger,
}: {
  tripId: string;
  tenantName: string;
  destination: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reference, setReference] = useState("");

  async function handleSettle() {
    setSaving(true);
    const result = await settleCreditTripAction(tripId, reference);
    setSaving(false);

    if (!result.ok) {
      toast.error("No se pudo liquidar el crédito", { description: result.error });
      return;
    }
    toast.success("Crédito liquidado.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="font-semibold">
            Marcar como pagado
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Liquidar crédito — {tenantName}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            {destination} · {formatMXN(amount)} · vencía el {dueDate}
            {daysOverdue > 0 ? ` (${daysOverdue}d de mora)` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`settle-ref-${tripId}`}>Referencia de pago</Label>
          <Input
            id={`settle-ref-${tripId}`}
            placeholder="SPEI-2026-09-001"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="tabular-nums"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="font-semibold"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSettle}
            disabled={saving || reference.trim().length < 4}
            className="font-semibold"
          >
            {saving ? "Liquidando…" : "Marcar como pagado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
