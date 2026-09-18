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
import {
  confirmBookingAction,
  reopenQuoteAction,
  completeTripAction,
} from "@/app/(ops)/ops/trips/actions";

function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy,
}: {
  trigger: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-display font-semibold">
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-h4 text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-body-s text-foreground/75">
            {description}
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
          <Button
            onClick={() => {
              setOpen(false);
              void onConfirm();
            }}
            disabled={busy}
            className="font-display font-semibold"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmBookingButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const result = await confirmBookingAction(tripId);
    setBusy(false);
    if (!result.ok) {
      toast.error("No se pudo confirmar", { description: result.error });
      return;
    }
    toast.success("Viaje confirmado.");
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger="Marcar como confirmado"
      title="Confirmar sin pago validado"
      description="Esta acción confirmará el viaje aunque no se haya validado el pago. ¿Continuar?"
      confirmLabel={busy ? "Confirmando…" : "Confirmar"}
      onConfirm={run}
      busy={busy}
    />
  );
}

export function CompleteTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const result = await completeTripAction(tripId);
    setBusy(false);
    if (!result.ok) {
      toast.error("No se pudo completar", { description: result.error });
      return;
    }
    toast.success("Viaje marcado como completado.");
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger="Marcar como completado"
      title="Completar viaje"
      description="El viaje pasará a estado Completado. ¿Continuar?"
      confirmLabel={busy ? "Guardando…" : "Completar"}
      onConfirm={run}
      busy={busy}
    />
  );
}

export function ReopenQuoteButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const result = await reopenQuoteAction(tripId);
    setBusy(false);
    if (!result.ok) {
      toast.error("No se pudo reabrir", { description: result.error });
      return;
    }
    toast.success("Cotización reabierta. Puedes editar las opciones.");
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger="Reabrir cotización"
      title="Reabrir cotización"
      description="El cliente dejará de ver las opciones y podrás editarlas. ¿Continuar?"
      confirmLabel={busy ? "Reabriendo…" : "Reabrir"}
      onConfirm={run}
      busy={busy}
    />
  );
}
