"use client";

import { FileText, Plane, Search, Users } from "lucide-react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { NAV_BY_ROLE } from "@/components/layout/sidebar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

/**
 * Command Palette TORA (⌘K / Ctrl+K).
 * Navegación del rol + acciones + búsqueda de entidades vía Supabase
 * (las queries respetan RLS: cada usuario solo ve lo suyo).
 * Abre también vía evento "tora:open-palette" (trigger del sidebar).
 */

interface EntityHit {
  kind: "trip" | "invoice" | "user";
  id: string;
  label: string;
  hint: string;
  href: string;
}

const ACTIONS_BY_ROLE: Partial<
  Record<Role, { label: string; href: string; keywords: string }[]>
> = {
  CLIENT_ADMIN: [
    { label: "Solicitar viaje", href: "/trips/new", keywords: "nuevo viaje crear solicitud" },
    { label: "Subir comprobante SPEI", href: "/wallet", keywords: "spei deposito comprobante billetera" },
  ],
  TORA_ADMIN: [
    { label: "Invitar usuario", href: "/admin/users", keywords: "invitar usuario crear" },
    { label: "Ver pipeline", href: "/admin/pipeline", keywords: "pipeline leads" },
  ],
  TORA_FINANCE: [
    { label: "Validar depósitos", href: "/finance/deposits", keywords: "spei validar depositos" },
  ],
};

/** Búsqueda de entidades del tenant (viajes, facturas, usuarios). */
async function searchEntities(
  query: string,
  role: Role
): Promise<EntityHit[]> {
  const supabase = createClient();
  const like = `%${query}%`;
  const hits: EntityHit[] = [];

  const clientNav = role === "CLIENT_ADMIN" || role === "CLIENT_FINANCE";

  // RLS filtra por tenant/staff según el rol autenticado
  const { data: trips } = await supabase
    .from("trips")
    .select("id, destination, status")
    .ilike("destination", like)
    .limit(5);
  for (const t of trips ?? []) {
    hits.push({
      kind: "trip",
      id: `trip-${t.id}`,
      label: t.destination,
      hint: "Viaje",
      href: clientNav ? `/trips/${t.id}` : "/ops/trips",
    });
  }

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, period, status")
    .ilike("period", like)
    .limit(5);
  for (const inv of invoices ?? []) {
    hits.push({
      kind: "invoice",
      id: `inv-${inv.id}`,
      label: `Factura ${inv.period}`,
      hint: "Factura",
      href: clientNav ? `/invoices` : "/finance/invoices",
    });
  }

  if (role === "TORA_ADMIN") {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, email")
      .or(`full_name.ilike.${like},email.ilike.${like}`)
      .limit(5);
    for (const u of users ?? []) {
      hits.push({
        kind: "user",
        id: `user-${u.id}`,
        label: u.full_name || u.email,
        hint: u.email,
        href: "/admin/users",
      });
    }
  }

  return hits;
}

export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<EntityHit[]>([]);
  const [searching, setSearching] = useState(false);

  const navSections = useMemo(() => NAV_BY_ROLE[role], [role]);
  const actions = ACTIONS_BY_ROLE[role] ?? [];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("tora:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("tora:open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  // Búsqueda de entidades con debounce corto
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchEntities(q, role);
        setHits(found);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query, role]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const hasEntities = hits.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-xl border-border-default bg-popover p-0 shadow-modal"
      >
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <Command loop>
          <div className="flex items-center gap-3 border-b border-border-subtle px-4">
            <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar viajes, facturas, personas o acciones…"
              className="h-13 w-full bg-transparent py-4 text-body-m text-text-primary outline-none placeholder:text-text-muted"
            />
            <kbd className="rounded border border-border-subtle bg-layer-1 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[360px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-body-s text-text-tertiary">
              {searching
                ? "Buscando…"
                : query.trim().length >= 2
                  ? "Sin resultados."
                  : "Escribe para buscar o elige un destino."}
            </Command.Empty>

            {hasEntities && (
              <Command.Group
                heading="Resultados"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
              >
                {hits.map((hit) => (
                  <Item key={hit.id} onSelect={() => go(hit.href)}>
                    {hit.kind === "trip" ? (
                      <Plane className="h-4 w-4" aria-hidden />
                    ) : hit.kind === "invoice" ? (
                      <FileText className="h-4 w-4" aria-hidden />
                    ) : (
                      <Users className="h-4 w-4" aria-hidden />
                    )}
                    <span className="flex-1 truncate">{hit.label}</span>
                    <span className="text-caption text-text-muted">{hit.hint}</span>
                  </Item>
                ))}
              </Command.Group>
            )}

            <Command.Group
              heading="Navegación"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
            >
              {navSections.flatMap((section) =>
                section.items.map((item) => (
                  <Item
                    key={`nav-${item.href}`}
                    onSelect={() => go(item.href)}
                    keywords={section.overline}
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-caption text-text-muted">
                      {section.overline}
                    </span>
                  </Item>
                ))
              )}
            </Command.Group>

            {actions.length > 0 && (
              <Command.Group
                heading="Acciones"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
              >
                {actions.map((action) => (
                  <Item
                    key={action.href}
                    onSelect={() => go(action.href)}
                    keywords={action.keywords}
                  >
                    <span className="flex-1">{action.label}</span>
                  </Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center gap-4 border-t border-border-subtle px-4 py-2.5 text-caption text-text-muted">
            <span>↑↓ navegar</span>
            <span>↵ seleccionar</span>
            <span>esc cerrar</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Item({
  children,
  onSelect,
  keywords,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  keywords?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      keywords={keywords ? [keywords] : undefined}
      className="flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-body-s text-text-secondary transition-colors data-[selected=true]:bg-layer-3 data-[selected=true]:text-text-primary"
    >
      {children}
    </Command.Item>
  );
}
