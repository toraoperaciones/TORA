"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateSeverity,
  SEVERITY_LABEL,
  type IncidentSeverity,
} from "@/lib/business/incidents";
import {
  createIncidentAction,
  resolveIncidentAction,
} from "@/app/(ops)/ops/trips/actions";

const INCIDENT_TYPES = [
  { value: "flight_delay", label: "Retraso de vuelo" },
  { value: "flight_cancelled", label: "Vuelo cancelado" },
  { value: "hotel_issue", label: "Problema de hotel" },
  { value: "car_issue", label: "Problema de auto" },
  { value: "billing_issue", label: "Problema de facturación" },
  { value: "other", label: "Otro" },
] as const;

/**
 * Sprint 5: la severidad es automática (reglas fijas) — el dialog la
 * muestra en vivo y NO permite override manual. El server la recalcula
 * como fuente de verdad al guardar.
 */
const SEVERITY_BADGE_CLASS: Record<IncidentSeverity, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/10 text-destructive",
  medium: "bg-muted text-muted-foreground",
  low: "bg-muted/50 text-muted-foreground",
};

export function NewIncidentDialog({
  activeTrips,
}: {
  activeTrips: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tripId, setTripId] = useState("");
  const [type, setType] = useState("flight_delay");
  const [delayHours, setDelayHours] = useState("");
  const [checkInDenied, setCheckInDenied] = useState(false);
  const [description, setDescription] = useState("");

  const severity = useMemo(
    () =>
      calculateSeverity({
        type: type as Parameters<typeof calculateSeverity>[0]["type"],
        delayHours:
          type === "flight_delay" && Number(delayHours) > 0
            ? Number(delayHours)
            : 0,
        checkInDenied,
      }),
    [type, delayHours, checkInDenied],
  );

  async function handleCreate() {
    if (!tripId) {
      toast.error("Selecciona el trip del incidente");
      return;
    }
    setSaving(true);
    const result = await createIncidentAction({
      tripId,
      type,
      description,
      delayHours:
        type === "flight_delay" && Number(delayHours) > 0
          ? Number(delayHours)
          : undefined,
      checkInDenied: type === "hotel_issue" ? checkInDenied : undefined,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error("No se pudo crear el incidente", {
        description: result.error,
      });
      return;
    }
    toast.success("Incidente creado.");
    setOpen(false);
    setTripId("");
    setType("flight_delay");
    setDelayHours("");
    setCheckInDenied(false);
    setDescription("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-semibold">Nuevo incidente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Nuevo incidente
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            Registra el problema para dar seguimiento. La severidad se asigna
            automáticamente según el tipo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Trip</Label>
            <Select value={tripId} onValueChange={setTripId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el trip" />
              </SelectTrigger>
              <SelectContent>
                {activeTrips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {trip.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Severidad (automática)</Label>
              <div className="flex h-9 items-center">
                <span
                  data-severity="live"
                  data-severity-value={severity}
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${SEVERITY_BADGE_CLASS[severity]}`}
                >
                  {SEVERITY_LABEL[severity]}
                </span>
              </div>
            </div>
          </div>

          {type === "flight_delay" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="incident-delay-hours">Horas de retraso</Label>
              <Input
                id="incident-delay-hours"
                type="number"
                min="0"
                step="0.5"
                placeholder="Ej. 3.5"
                value={delayHours}
                onChange={(e) => setDelayHours(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Más de 2 horas se clasifica como alta; 2 horas o menos, media.
              </p>
            </div>
          )}

          {type === "hotel_issue" && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 accent-[var(--primary)]"
                checked={checkInDenied}
                onChange={(e) => setCheckInDenied(e.target.checked)}
              />
              <span>Al cliente le negaron el check-in</span>
            </label>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="incident-description">Descripción</Label>
            <Textarea
              id="incident-description"
              rows={3}
              placeholder="Qué ocurrió, quién está afectado, qué se necesita…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="font-semibold"
          >
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="font-semibold">
            {saving ? "Creando…" : "Crear incidente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResolveIncidentDialog({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  async function handleResolve() {
    setSaving(true);
    const result = await resolveIncidentAction({
      incidentId,
      resolutionNotes: notes,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error("No se pudo resolver el incidente", {
        description: result.error,
      });
      return;
    }
    toast.success("Incidente resuelto.");
    setOpen(false);
    setNotes("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="font-semibold"
        >
          Ver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Resolver incidente
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            Describe cómo se resolvió. Quedará registrado con tu usuario y fecha.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`resolution-${incidentId}`}>Notas de resolución</Label>
          <Textarea
            id={`resolution-${incidentId}`}
            rows={3}
            placeholder="Vuelo reprogramado, cliente notificado…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="font-semibold"
          >
            Cerrar
          </Button>
          <Button onClick={handleResolve} disabled={saving} className="font-semibold">
            {saving ? "Guardando…" : "Marcar como resuelto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
