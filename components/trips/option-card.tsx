"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AnimatedCheck } from "@/components/ui/animated-check";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMXN } from "@/lib/utils";

export interface TripOptionPublic {
  id: string;
  provider: string;
  final_price: number;
  details: Record<string, unknown> | null;
  is_selected: boolean;
  expires_at: string | null;
}

/**
 * Card de opción de viaje.
 * REGLA DE ORO: este componente SOLO recibe final_price. net_price jamás
 * llega a props (las páginas filtran la columna en el select de Supabase).
 */
export function OptionCard({
  option,
  canSelect,
  tripId,
}: {
  option: TripOptionPublic;
  canSelect: boolean;
  tripId: string;
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  // Check persistente en el lugar: sobrevive al router.refresh() de la página.
  const [justConfirmed, setJustConfirmed] = useState(false);

  const details = option.details
    ? Object.entries(option.details)
        .filter(([, value]) => value !== null && value !== "")
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(" · ")
    : null;

  async function handleSelect() {
    setSelecting(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_id: option.id }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        status?: string;
        tripStatus?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        toast.error("No se pudo seleccionar la opción", {
          description: payload.error ?? "Inténtalo de nuevo.",
        });
        return;
      }

      if ((payload.status ?? payload.tripStatus) === "confirmed") {
        toast.success("Reserva confirmada.", { duration: 4000 });
        setJustConfirmed(true);
      } else {
        toast.success("Opción seleccionada.");
      }
      router.refresh();
    } catch {
      toast.error("Error de red", {
        description: "No se pudo contactar al servidor.",
      });
    } finally {
      setSelecting(false);
    }
  }

  return (
    <Card
      className={
        option.is_selected
          ? "border-2 border-primary bg-card shadow-none"
          : "border-border bg-card shadow-none"
      }
    >
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">{option.provider}</h3>
            {option.is_selected && (
              <Badge className="border-transparent bg-primary text-foreground">
                Seleccionada
              </Badge>
            )}
          </div>
          {details && (
            <p className="mt-1 truncate text-sm text-foreground/75">{details}</p>
          )}
          {option.expires_at && (
            <p className="mt-1 text-xs text-foreground/75">
              Vigencia: {new Date(option.expires_at).toLocaleDateString("es-MX")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <span className="text-xl font-semibold tabular-nums text-foreground">
            {formatMXN(option.final_price)}
          </span>
          {canSelect && !option.is_selected && (
            <Button
              onClick={handleSelect}
              disabled={selecting}
              className="font-semibold"
            >
              {selecting ? "Seleccionando…" : "Seleccionar"}
            </Button>
          )}
          {option.is_selected && (
            <Button disabled variant="outline" className="font-semibold">
              Seleccionada
            </Button>
          )}
          {justConfirmed && <AnimatedCheck />}
        </div>
      </CardContent>
    </Card>
  );
}
