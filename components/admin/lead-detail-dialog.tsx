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
import { deleteLeadAction } from "@/app/(admin)/admin/pipeline/actions";
import { LeadFormDialog, type LeadInput } from "@/components/admin/lead-form-dialog";
import { formatMXN } from "@/lib/utils";

interface LeadDetailDialogProps {
  lead: LeadInput & { id: string; last_contact_at: string | null };
  trigger: React.ReactNode;
  onDeleted?: () => void;
}

export function LeadDetailDialog({ lead, trigger, onDeleted }: LeadDetailDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteLeadAction(lead.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error("No se pudo eliminar", { description: result.error });
      return;
    }
    toast.success("Lead eliminado.");
    setOpen(false);
    onDeleted?.();
    router.refresh();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-h4 text-navy">
              {lead.company_name}
            </DialogTitle>
            <DialogDescription className="text-body-s text-graphite">
              Etapa: {lead.stage}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 text-body-s text-navy">
            <p>Contacto: {lead.contact_name ?? "—"}</p>
            <p>Email: {lead.contact_email ?? "—"}</p>
            <p>Teléfono: {lead.contact_phone ?? "—"}</p>
            <p>
              Gasto mensual estimado:{" "}
              <span className="tabular-nums font-semibold">
                {formatMXN(lead.estimated_monthly_spend ?? 0)}
              </span>
            </p>
            <p className="text-caption text-graphite">
              Último contacto: {lead.last_contact_at ? timeAgo(lead.last_contact_at) : "—"}
            </p>
            {lead.notes && <p className="text-graphite">{lead.notes}</p>}
          </div>

          <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-between">
            <Button
              variant="outline"
              className="font-display font-semibold"
              onClick={() => {
                setOpen(false);
                router.push(
                  `/admin/tenants?from_lead=${lead.id}&name=${encodeURIComponent(lead.company_name)}`
                );
              }}
            >
              Convertir a tenant
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)} className="font-display font-semibold">
                Editar
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="font-display font-semibold text-navy"
              >
                {deleting ? "Eliminando…" : "Eliminar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadFormDialog
        lead={lead}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "hace minutos";
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}
