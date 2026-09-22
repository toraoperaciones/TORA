"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ReceiptViewer } from "@/components/finance/receipt-viewer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveDepositAction,
  rejectDepositAction,
} from "@/app/(finance)/finance/actions";
import { formatMXN } from "@/lib/utils";

export interface DepositRowData {
  id: string;
  amount: string | number;
  reference: string | null;
  receipt_url: string | null;
  created_at: string;
  tenants: { id: string; name: string; rfc: string | null } | null;
  creator: { full_name: string | null; email: string } | null;
}

function timeAgo(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `hace ${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

export function DepositRow({ deposit }: { deposit: DepositRowData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function handleApprove() {
    setBusy("approve");
    const result = await approveDepositAction(deposit.id);
    setBusy(null);

    if (!result.ok) {
      toast.error("No se pudo aprobar el depósito", { description: result.error });
      return;
    }
    toast.success(
      `Depósito aprobado. ${result.confirmed_trips} viaje${result.confirmed_trips === 1 ? "" : "s"} confirmado${result.confirmed_trips === 1 ? "" : "s"}.`
    );
    router.refresh();
  }

  async function handleReject() {
    setBusy("reject");
    const result = await rejectDepositAction(deposit.id, reason);
    setBusy(null);

    if (!result.ok) {
      toast.error("No se pudo rechazar el depósito", { description: result.error });
      return;
    }
    toast.success("Depósito rechazado.");
    setRejectOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <>
      <tr className="border-border">
        <td className="px-4 py-3 text-sm font-semibold text-foreground">
          {deposit.tenants?.name ?? "—"}
        </td>
        <td className="px-4 py-3 text-sm text-foreground/75">
          {deposit.creator?.full_name ?? deposit.creator?.email ?? "—"}
        </td>
        <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
          {deposit.reference ?? "—"}
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-foreground">
          {formatMXN(Number(deposit.amount))}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {timeAgo(deposit.created_at)}
        </td>
        <td className="px-4 py-3 text-right">
          {deposit.receipt_url && (
            <Button variant="ghost" size="sm" onClick={() => setViewerOpen(true)}>
              Ver
            </Button>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={busy !== null}
              onClick={handleApprove}
            >
              {busy === "approve" ? "Aprobando…" : "Aprobar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => setRejectOpen(true)}
            >
              Rechazar
            </Button>
          </div>
        </td>
      </tr>

      <ReceiptViewer
        path={deposit.receipt_url}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Rechazar depósito
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              El cliente verá el depósito como rechazado. Explica el motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`reject-reason-${deposit.id}`}>Motivo</Label>
            <Textarea
              id={`reject-reason-${deposit.id}`}
              rows={3}
              placeholder="El comprobante no corresponde al monto reportado…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null || reason.trim().length < 5}
              onClick={handleReject}
            >
              {busy === "reject" ? "Rechazando…" : "Confirmar rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
