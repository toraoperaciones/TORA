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

const SEVERITIES = [
  { value: "critical", label: "Crítica" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
] as const;

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
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");

  async function handleCreate() {
    if (!tripId) {
      toast.error("Selecciona el trip del incidente");
      return;
    }
    setSaving(true);
    const result = await createIncidentAction({
      tripId,
      type,
      severity,
      description,
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
    setDescription("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-display font-semibold">Nuevo incidente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-h4 text-navy">
            Nuevo incidente
          </DialogTitle>
          <DialogDescription className="text-body-s text-graphite">
            Registra el problema para dar seguimiento.
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
              <Label>Severidad</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
            className="font-display font-semibold"
          >
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="font-display font-semibold">
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
          className="font-display font-semibold"
        >
          Ver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-h4 text-navy">
            Resolver incidente
          </DialogTitle>
          <DialogDescription className="text-body-s text-graphite">
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
            className="font-display font-semibold"
          >
            Cerrar
          </Button>
          <Button onClick={handleResolve} disabled={saving} className="font-display font-semibold">
            {saving ? "Guardando…" : "Marcar como resuelto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
