import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

import { TicketForm } from "./ticket-form";

export const metadata: Metadata = pageMetadata("Soporte");

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Abierto",
  in_progress: "En proceso",
  resolved: "Resuelto",
  closed: "Cerrado",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SoportePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, subject, priority, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const whatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Soporte TORA</h1>
        <p className="mt-1 text-sm text-foreground/75">
          Respondemos en menos de 4 horas hábiles.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground">WhatsApp</CardTitle>
            <CardDescription className="text-xs text-foreground/75">
              El canal más rápido
            </CardDescription>
          </CardHeader>
          <CardContent>
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-foreground underline underline-offset-4"
              >
                Abrir chat
              </a>
            ) : (
              <p className="text-xs text-foreground/60">
                Disponible al activar la línea de soporte.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground">Correo</CardTitle>
            <CardDescription className="text-xs text-foreground/75">
              Con copia de todo por escrito
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="mailto:soporte@tora.mx"
              className="text-sm font-semibold text-foreground underline underline-offset-4"
            >
              soporte@tora.mx
            </a>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground">Horario</CardTitle>
            <CardDescription className="text-xs text-foreground/75">
              Tiempo de respuesta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">Lunes a viernes, 9:00–19:00 CDMX.</p>
            <p className="mt-1 text-xs text-foreground/60">SLA: menos de 4 horas hábiles.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Crear un ticket
          </CardTitle>
          <CardDescription className="text-sm text-foreground/75">
            Describe tu problema o solicitud y el equipo de TORA te contacta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TicketForm />
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Mis tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets && tickets.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">{ticket.subject}</p>
                    <p className="text-xs text-foreground/60">
                      {formatDate(ticket.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={ticket.priority === "urgent" ? "default" : "outline"}
                      className="text-xs"
                    >
                      {PRIORITY_LABEL[ticket.priority] ?? ticket.priority}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {STATUS_LABEL[ticket.status] ?? ticket.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground/75">
              Aún no tienes tickets. Crea uno arriba y te respondemos el mismo día hábil.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
