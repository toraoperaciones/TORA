"use client";

import { RiErrorWarningLine, RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateFinalPrice,
  isMarginHealthy,
  marginPercent,
  markupFor,
  type ServiceType,
  type TenantMarkups,
} from "@/lib/business/markup";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { notifyTripOptionsSentAction } from "@/app/(ops)/ops/trips/actions";

const MAX_OPTIONS = 4;

export interface ExistingOption {
  id: string;
  provider: string;
  net_price: number;
  final_price: number;
  details: Record<string, unknown> | null;
  expires_at: string | null;
}

interface DraftOption {
  key: string;
  provider: string;
  net_price: string;
  final_price: string;
  details: string;
  expires_at: string;
  touched: boolean;
}

function emptyOption(): DraftOption {
  return {
    key: crypto.randomUUID(),
    provider: "",
    net_price: "",
    final_price: "",
    details: "",
    expires_at: "",
    touched: false,
  };
}

function fromExisting(option: ExistingOption): DraftOption {
  const notes = option.details?.notas;
  return {
    key: option.id,
    provider: option.provider,
    net_price: String(option.net_price),
    final_price: String(option.final_price),
    details: typeof notes === "string" ? notes : "",
    expires_at: option.expires_at ? option.expires_at.slice(0, 10) : "",
    touched: true,
  };
}

export function QuoteBuilder({
  tripId,
  serviceType,
  markups,
  existingOptions,
  tripStatus,
  requesterId,
  requesterName,
  destination,
}: {
  tripId: string;
  serviceType: ServiceType;
  markups: TenantMarkups;
  existingOptions: ExistingOption[];
  tripStatus: string;
  requesterId: string | null;
  requesterName: string;
  destination: string;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<DraftOption[]>(() =>
    existingOptions.length > 0 ? existingOptions.map(fromExisting) : [emptyOption()]
  );
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const markup = markupFor(markups, serviceType);
  const editable = ["pending_quote", "options_sent", "awaiting_selection"].includes(
    tripStatus
  );

  function updateOption(key: string, patch: Partial<DraftOption>) {
    setOptions((prev) =>
      prev.map((opt) => {
        if (opt.key !== key) return opt;
        const next = { ...opt, ...patch };
        // Recalcular final_price solo si el usuario no lo editó a mano.
        if (patch.net_price !== undefined && !next.touched) {
          const net = Number(next.net_price);
          if (!Number.isNaN(net) && net > 0) {
            next.final_price = String(calculateFinalPrice(net, markup));
          } else {
            next.final_price = "";
          }
        }
        return next;
      })
    );
  }

  function touchFinal(key: string) {
    setOptions((prev) =>
      prev.map((opt) => (opt.key === key ? { ...opt, touched: true } : opt))
    );
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, emptyOption()]);
  }

  function removeOption(key: string) {
    if (options.length <= 1) return;
    setOptions((prev) => prev.filter((opt) => opt.key !== key));
  }

  function validate(): string | null {
    if (options.length < 1 || options.length > MAX_OPTIONS) {
      return `Debe haber entre 1 y ${MAX_OPTIONS} opciones`;
    }
    for (const [i, opt] of options.entries()) {
      const net = Number(opt.net_price);
      const final = Number(opt.final_price);
      if (!opt.provider.trim()) return `Opción ${i + 1}: falta el proveedor`;
      if (Number.isNaN(net) || net <= 0)
        return `Opción ${i + 1}: el precio neto debe ser mayor a 0`;
      if (Number.isNaN(final) || final < net)
        return `Opción ${i + 1}: el precio final no puede ser menor al neto`;
    }
    return null;
  }

  function toRpcPayload() {
    return options.map((opt) => ({
      provider: opt.provider.trim(),
      net_price: Number(opt.net_price),
      final_price: Number(opt.final_price),
      details: opt.details.trim() ? { notas: opt.details.trim() } : null,
      expires_at: opt.expires_at || null,
    }));
  }

  async function submit(send: boolean) {
    const validationError = validate();
    if (validationError) {
      toast.error("Revisa las opciones", { description: validationError });
      return;
    }

    setSending(true);
    const supabase = createClient();

    const { error } = await supabase.rpc("replace_trip_options", {
      p_trip_id: tripId,
      p_options: toRpcPayload(),
      p_send_to_client: send,
    });

    if (error) {
      toast.error("No se pudo guardar la cotización", {
        description: error.message,
      });
      setSending(false);
      return;
    }

    // Notificación in-app + WhatsApp (server action; el cliente no inserta).
    if (send && requesterId) {
      await notifyTripOptionsSentAction({
        tripId,
        requesterId,
        requesterName,
        destination,
        optionsCount: options.length,
      });
    }

    if (send) {
      toast.success("Opciones enviadas al cliente.");
      router.push("/ops/inbox");
      router.refresh();
    } else {
      toast.success("Borrador guardado. El cliente aún no ve las opciones.");
      setSending(false);
      router.refresh();
    }
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Opciones de cotización
        </CardTitle>
        <CardDescription className="text-sm text-foreground/75">
          Markup aplicado: {(markup * 100).toFixed(0)}% ({serviceType}). El precio
          final se calcula automáticamente, pero puedes ajustarlo por opción.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {options.map((opt, index) => {
          const net = Number(opt.net_price);
          const final = Number(opt.final_price);
          const hasPrices = !Number.isNaN(net) && net > 0 && !Number.isNaN(final);
          const margin = hasPrices ? marginPercent(net, final) : null;

          return (
            <div
              key={opt.key}
              className="rounded-lg border border-border p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/75">
                  Opción {index + 1}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!editable || options.length <= 1}
                  onClick={() => removeOption(opt.key)}
                  aria-label={`Eliminar opción ${index + 1}`}
                >
                  <RiDeleteBinLine className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor={`provider-${opt.key}`}>Proveedor</Label>
                  <Input
                    id={`provider-${opt.key}`}
                    placeholder="Aeroméxico, Marriott, Hertz…"
                    disabled={!editable}
                    value={opt.provider}
                    onChange={(e) =>
                      updateOption(opt.key, { provider: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor={`net-${opt.key}`}>Precio neto (MXN)</Label>
                  <Input
                    id={`net-${opt.key}`}
                    type="number"
                    min="0"
                    step="0.01"
                    className="tabular-nums"
                    disabled={!editable}
                    value={opt.net_price}
                    onChange={(e) =>
                      updateOption(opt.key, { net_price: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor={`final-${opt.key}`}>
                    Precio final (MXN)
                    {opt.touched && (
                      <span className="ml-2 font-normal normal-case text-foreground/75">
                        editado
                      </span>
                    )}
                  </Label>
                  <Input
                    id={`final-${opt.key}`}
                    type="number"
                    min="0"
                    step="0.01"
                    className="tabular-nums"
                    disabled={!editable}
                    value={opt.final_price}
                    onChange={(e) => {
                      touchFinal(opt.key);
                      updateOption(opt.key, { final_price: e.target.value });
                    }}
                  />
                </div>

                <div className="flex flex-col gap-2 md:col-span-3">
                  <Label htmlFor={`details-${opt.key}`}>Notas</Label>
                  <Textarea
                    id={`details-${opt.key}`}
                    rows={2}
                    placeholder="Vuelo AM 904, economy, 1 maleta…"
                    disabled={!editable}
                    value={opt.details}
                    onChange={(e) =>
                      updateOption(opt.key, { details: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor={`expires-${opt.key}`}>Expira (opcional)</Label>
                  <Input
                    id={`expires-${opt.key}`}
                    type="date"
                    disabled={!editable}
                    value={opt.expires_at}
                    onChange={(e) =>
                      updateOption(opt.key, { expires_at: e.target.value })
                    }
                  />
                </div>

                <div className="md:col-span-4">
                  {margin !== null && (
                    <p
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-semibold",
                        isMarginHealthy(net, final) ? "text-foreground/75" : "text-foreground"
                      )}
                    >
                      {!isMarginHealthy(net, final) && (
                        <RiErrorWarningLine className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Margen: {margin.toFixed(1)}%
                      {!isMarginHealthy(net, final) && " — margen bajo, revisa la captura"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={addOption}
            disabled={!editable || options.length >= MAX_OPTIONS}
            className="font-semibold"
          >
            <RiAddLine className="h-4 w-4" />
            Agregar opción
          </Button>
          <p className="text-xs text-foreground/75">
            {options.length} de {MAX_OPTIONS} opciones usadas
          </p>
        </div>

        {editable ? (
          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={sending}
              onClick={() => submit(false)}
              className="font-semibold"
            >
              Guardar borrador
            </Button>
            <Button
              type="button"
              disabled={sending}
              onClick={() => setDialogOpen(true)}
              className="font-semibold"
            >
              Enviar al cliente
            </Button>
          </div>
        ) : (
          <p className="border-t border-border pt-4 text-sm text-foreground/75">
            Este trip ya no admite edición de opciones desde su estado actual.
          </p>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Enviar al cliente
            </DialogTitle>
            <DialogDescription className="text-sm text-foreground/75">
              ¿Enviar estas {options.length} opciones al cliente? No podrás
              modificarlas sin antes reabrirlas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="font-semibold"
            >
              Cancelar
            </Button>
            <Button
              disabled={sending}
              onClick={() => {
                setDialogOpen(false);
                submit(true);
              }}
              className="font-semibold"
            >
              {sending ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
