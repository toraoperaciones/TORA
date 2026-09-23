"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createSupportTicketAction } from "./actions";

/**
 * Formulario de ticket de soporte. El usuario autenticado crea tickets;
 * la lista de abajo se refresca vía router.refresh() tras el alta.
 */
export function TicketForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createSupportTicketAction({ subject, description, priority });
    setSubmitting(false);

    if (!result.ok) {
      toast.error("No se pudo crear el ticket", { description: result.error });
      return;
    }
    toast.success("Ticket creado. Te contactaremos pronto.");
    setSubject("");
    setDescription("");
    setPriority("normal");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-subject">Asunto</Label>
        <Input
          id="ticket-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Resumen del problema o solicitud"
          maxLength={100}
        />
        <p className="text-xs text-foreground/60">Entre 5 y 100 caracteres.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-description">Descripción</Label>
        <textarea
          id="ticket-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Cuéntanos qué pasó. Incluye destino, fecha y número de pasajeros si aplica."
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        />
        <p className="text-xs text-foreground/60">Entre 20 y 2000 caracteres.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-priority">Prioridad</Label>
        <select
          id="ticket-priority"
          value={priority}
          onChange={(e) =>
            setPriority(e.target.value as "normal" | "high" | "urgent")
          }
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>

      <div>
        <Button type="submit" disabled={submitting} className="font-semibold">
          {submitting ? "Enviando…" : "Crear ticket"}
        </Button>
      </div>
    </form>
  );
}
