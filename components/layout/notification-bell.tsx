"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EmptySearch } from "@/components/illustrations/illustrations";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Campana de notificaciones — lee public.notifications (RLS: cada usuario
 * ve solo las suyas). v1 read-only: la policy UPDATE para marcar como
 * leída está redactada en supabase/migrations/0009 (pendiente de aplicar).
 */

interface NotificationRow {
  id: string;
  type: string;
  payload: { trip_id?: string; options_count?: number } | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  trip_options_sent: "Opciones de viaje listas",
  trip_confirmed: "Viaje confirmado",
  deposit_approved: "Depósito aprobado",
  deposit_rejected: "Depósito rechazado",
};

function timeAgo(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

export function NotificationBell({ canLinkTrips }: { canLinkTrips: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("id, type, payload, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      const rows = (data ?? []) as NotificationRow[];
      setItems(rows);
      setUnread(rows.filter((n) => !n.read_at).length);
    } catch {
      // sin sesión o red: la campana queda vacía
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-layer-2 hover:text-text-primary"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-offwhite"
          />
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full border-border-hairline bg-navy-deep sm:max-w-sm"
        >
          <SheetHeader className="border-b border-border-hairline pb-4">
            <SheetTitle className="font-display text-h4 text-text-primary">
              Notificaciones
            </SheetTitle>
            <SheetDescription className="text-caption text-text-tertiary">
              Actividad de tus viajes y billetera.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 pt-12 text-center">
                <EmptySearch className="h-24 w-24" />
                <p className="text-body-s text-text-tertiary">
                  Sin notificaciones por ahora.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border-subtle">
                {items.map((n) => (
                  <li key={n.id} className="py-3">
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          n.read_at ? "bg-text-muted" : "bg-offwhite"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-body-s font-medium text-text-primary">
                          {TYPE_LABEL[n.type] ?? n.type}
                        </p>
                        {n.payload?.options_count ? (
                          <p className="mt-0.5 text-caption text-text-tertiary">
                            {n.payload.options_count} opción
                            {n.payload.options_count === 1 ? "" : "es"} para
                            revisar.
                          </p>
                        ) : null}
                        <p className="mt-1 text-caption text-text-muted">
                          {timeAgo(n.created_at)}
                        </p>
                        {canLinkTrips && n.payload?.trip_id && (
                          <Link
                            href={`/trips/${n.payload.trip_id}`}
                            onClick={() => setOpen(false)}
                            className="mt-2 inline-block text-caption font-semibold text-text-primary underline underline-offset-4"
                          >
                            Ver viaje
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
