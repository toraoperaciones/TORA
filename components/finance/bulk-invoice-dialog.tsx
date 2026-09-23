"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  invoiceTenantAction,
  type TenantInvoiceResult,
} from "@/app/(finance)/finance/invoices/actions";
import { Badge } from "@/components/ui/badge";
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

interface Candidate {
  id: string;
  name: string;
  trips: number;
  amount: number;
}

/**
 * Facturación masiva del período. El cliente emite secuencialmente con la
 * action por-tenant: el progreso es real (no fake), los fallidos quedan
 * identificados y se reintentan con un click.
 */
export function BulkInvoiceDialog({
  period,
  candidates,
}: {
  period: string;
  candidates: Candidate[];
}) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TenantInvoiceResult[]>([]);

  const done = results.length;
  const okCount = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const retryable = failed.filter((r) => !r.error?.includes("Sin viajes"));

  async function run(targets: Candidate[]) {
    setRunning(true);
    for (const candidate of targets) {
      // Secuencial a propósito: Facturapi cobra por timbre y un fallo de red
      // no debe detener el resto; el estado se pinta en vivo.
      const result = await invoiceTenantAction({
        tenantId: candidate.id,
        tenantName: candidate.name,
        period,
      });
      setResults((prev) => [
        ...prev.filter((r) => r.tenantId !== candidate.id),
        result,
      ]);
    }
    setRunning(false);
    if (failed.length === 0 && targets.length > 0) {
      toast.success(`Facturación de ${period} completada.`);
    }
  }

  function start() {
    setResults([]);
    void run(candidates);
  }

  async function retryFailed() {
    const retryCandidates = candidates.filter((c) =>
      retryable.some((r) => r.tenantId === c.id)
    );
    await run(retryCandidates);
  }

  if (candidates.length === 0) {
    return (
      <Button variant="outline" disabled className="font-semibold">
        Facturar todo el mes
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-semibold">Facturar todo el mes</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Facturar {period}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            Emite un CFDI por cliente con su empresa emisora asignada. Los que
            ya están timbrados se omiten automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {candidates.map((candidate) => {
            const result = results.find((r) => r.tenantId === candidate.id);
            return (
              <div
                key={candidate.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {candidate.name}
                  </p>
                  <p className="text-xs text-foreground/60">
                    {candidate.trips} viaje{candidate.trips === 1 ? "" : "s"} del período
                  </p>
                </div>
                {result ? (
                  result.ok ? (
                    <Badge className="border-transparent bg-primary font-medium text-primary-foreground">
                      Emitida
                    </Badge>
                  ) : (
                    <Badge
                      className="max-w-[180px] truncate border-border bg-transparent font-medium text-foreground/75"
                      title={result.error}
                    >
                      {result.error?.slice(0, 40) ?? "Error"}
                    </Badge>
                  )
                ) : (
                  <span className="text-xs text-foreground/50">En cola</span>
                )}
              </div>
            );
          })}
        </div>

        {done > 0 && (
          <p className="text-sm text-foreground/75">
            {done}/{candidates.length} procesados · {okCount} emitidas
            {failed.length > 0 ? ` · ${failed.length} con error` : ""}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="font-semibold"
          >
            Cerrar
          </Button>
          {retryable.length > 0 && !running ? (
            <Button onClick={retryFailed} className="font-semibold">
              Reintentar {retryable.length} fallido{retryable.length === 1 ? "" : "s"}
            </Button>
          ) : (
            <Button onClick={start} disabled={running} className="font-semibold">
              {running
                ? `Emitiendo… (${done}/${candidates.length})`
                : done > 0
                  ? "Emitir de nuevo"
                  : `Emitir ${candidates.length} CFDI`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
