"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { approveCreditForTripAction } from "@/app/(finance)/finance/actions";
import { AnimatedCheck } from "@/components/ui/animated-check";
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
import { formatMXN } from "@/lib/utils";

/**
 * Flujo C: aprueba crédito para cubrir el cargo pendiente de un trip en
 * awaiting_payment. Si el tenant no tiene línea activa, el límite ingresado
 * se usa para crearla (la RPC exige p_new_limit >= monto del cargo).
 */
export function ApproveCreditButton({
  tripId,
  tenantName,
  destination,
  chargeAmount,
}: {
  tripId: string;
  tenantName: string;
  destination: string;
  chargeAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Check persistente en el lugar: sobrevive al router.refresh() del listado.
  const [approved, setApproved] = useState(false);
  const [limit, setLimit] = useState("");

  async function handleApprove() {
    const trimmed = limit.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < chargeAmount)) {
      toast.error("Límite insuficiente", {
        description: `Debe ser mayor o igual a ${formatMXN(chargeAmount)}.`,
      });
      return;
    }

    setSaving(true);
    const result = await approveCreditForTripAction(tripId, parsed);
    setSaving(false);

    if (!result.ok) {
      toast.error("No se pudo aprobar el crédito", { description: result.error });
      return;
    }

    toast.success("Crédito aprobado. Reserva confirmada.", { duration: 4000 });
    setApproved(true);
    // El dialog queda abierto con el check visible; el usuario lo cierra.
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-display font-semibold">
          Aprobar crédito
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-h4 text-text-primary">
            Aprobar crédito — {tenantName}
          </DialogTitle>
          <DialogDescription className="text-body-s text-text-secondary">
            Cubre el cargo de {formatMXN(chargeAmount)} del trip a {destination} y
            confirma la reserva. El cargo queda pendiente de pago a 30 días.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`credit-limit-${tripId}`}>
              Límite de línea (MXN) — vacío usa la línea activa actual
            </Label>
            <Input
              id={`credit-limit-${tripId}`}
              type="number"
              min={chargeAmount}
              step="500"
              placeholder={String(Math.ceil(chargeAmount / 1000) * 1000)}
              className="tabular-nums"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
            <p className="text-caption text-text-secondary">
              Mínimo requerido: {formatMXN(chargeAmount)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="font-display font-semibold"
          >
            Cancelar
          </Button>
          <Button onClick={handleApprove} disabled={saving} className="font-display font-semibold">
            {saving ? "Aprobando…" : "Aprobar"}
          </Button>
          {approved && <AnimatedCheck />}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
