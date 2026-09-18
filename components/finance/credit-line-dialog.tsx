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
import { upsertCreditLineAction } from "@/app/(finance)/finance/actions";

export function CreditLineDialog({
  tenant,
  currentLimit,
  currentRate,
  trigger,
}: {
  tenant: { id: string; name: string };
  currentLimit: number | null;
  currentRate: number | null;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [limit, setLimit] = useState(currentLimit ? String(currentLimit) : "");
  const [rate, setRate] = useState(currentRate ? String(currentRate) : "0.025");

  async function handleSave() {
    setSaving(true);
    const result = await upsertCreditLineAction(
      tenant.id,
      Number(limit),
      Number(rate)
    );
    setSaving(false);

    if (!result.ok) {
      toast.error("No se pudo guardar la línea", { description: result.error });
      return;
    }
    toast.success("Línea de crédito actualizada.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="font-display font-semibold">
            Ajustar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-h4 text-text-primary">
            Línea de crédito — {tenant.name}
          </DialogTitle>
          <DialogDescription className="text-body-s text-text-secondary">
            El crédito es a 30 días sin interés. Después aplica la tasa mensual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`limit-${tenant.id}`}>Límite aprobado (MXN)</Label>
            <Input
              id={`limit-${tenant.id}`}
              type="number"
              min="0"
              step="1000"
              className="tabular-nums"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`rate-${tenant.id}`}>Tasa de interés mensual (0.025 = 2.5%)</Label>
            <Input
              id={`rate-${tenant.id}`}
              type="number"
              min="0"
              max="1"
              step="0.005"
              className="tabular-nums"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
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
          <Button onClick={handleSave} disabled={saving} className="font-display font-semibold">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
