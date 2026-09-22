"use client";

import { RiTimeLine, RiFileTextLine, RiFlightTakeoffLine, RiSearchLine, RiTeamLine } from "@remixicon/react";
import { Command } from "cmdk";
import Fuse from "fuse.js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { NAV_BY_ROLE, type NavItemDef } from "@/lib/navigation";
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
 * (las queries respetan RLS: cada usuario solo ve lo suyo) + Recientes
 * (últimos 5 destinos, persistidos en localStorage por rol).
 * Abre también vía evento "tora:open-palette" (trigger del sidebar).
 */

const RECENTS_KEY = "tora-palette-recents";
const RECENTS_MAX = 5;

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function pushRecent(href: string) {
  // Solo destinos internos de navegación (no resultados de búsqueda volátiles).
  if (!href.startsWith("/") || href.includes("?")) return;
  try {
    const next = [href, ...readRecents().filter((h) => h !== href)].slice(0, RECENTS_MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage lleno o bloqueado: los recientes son best-effort */
  }
}

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

  const navSections = useMemo(() => NAV_BY_ROLE[role], [role]);

  /** Aplana flat|grouped a lista de items con su grupo como hint. */
  const flatNav = useMemo(
    () =>
      navSections.flatMap((section) =>
        section.type === "flat"
          ? section.items.map((item) => ({ item, hint: "Navegación" }))
          : section.groups.flatMap((group) =>
              group.items.map((item) => ({ item, hint: group.label }))
            )
      ),
    [navSections]
  );
  const actions = useMemo(() => ACTIONS_BY_ROLE[role] ?? [], [role]);

  // Filtrado propio (shouldFilter=false en <Command>): cmdk no re-evalúa
  // items que se montan tarde (hits asíncronos) y los dejaba ocultos.
  const q = query.trim().toLowerCase();
  const navMatches = useMemo(() => {
    if (!q) return flatNav;
    return new Fuse(flatNav, {
      keys: ["item.label", "hint"],
      threshold: 0.35,
      ignoreLocation: true,
    })
      .search(q)
      .map((r) => r.item);
  }, [flatNav, q]);
  const actionMatches = useMemo(() => {
    if (!q) return actions;
    return new Fuse(actions, {
      keys: ["label", "keywords"],
      threshold: 0.35,
      ignoreLocation: true,
    })
      .search(q)
      .map((r) => r.item);
  }, [actions, q]);

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
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const found = await searchEntities(q, role);
        setHits(found);
      } catch {
        setHits([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query, role]);

  const go = useCallback(
    (href: string) => {
      pushRecent(href);
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  // Recientes: se leen al abrir (localStorage no existe en SSR).
  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => {
    if (open) setRecents(readRecents());
  }, [open]);

  const hasEntities = hits.length > 0;
  const recentItems = useMemo(
    () =>
      recents
        .map((href) => {
          const match = flatNav.find(({ item }) => item.href === href);
          return match
            ? { href, label: match.item.label, icon: match.item.icon, hint: match.hint }
            : null;
        })
        .filter((x): x is { href: string; label: string; icon: NavItemDef["icon"]; hint: string } => x !== null),
    [recents, flatNav]
  );
  const isEmpty =
    !hasEntities && navMatches.length === 0 && actionMatches.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-xl border-border bg-popover p-0 shadow-2xl"
      >
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <Command shouldFilter={false} loop>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <RiSearchLine className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar viajes, facturas, personas o acciones…"
              className="h-13 w-full bg-transparent py-4 text-base text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[360px] overflow-y-auto p-2">
            {!query.trim() && recentItems.length > 0 && (
              <Command.Group
                heading="Recientes"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/70"
              >
                {recentItems.map((r) => (
                  <Item key={`recent-${r.href}`} onSelect={() => go(r.href)}>
                    <RiTimeLine className="h-4 w-4 text-muted-foreground/70" aria-hidden />
                    <span className="flex-1">{r.label}</span>
                    <span className="text-xs text-muted-foreground/70">{r.hint}</span>
                  </Item>
                ))}
              </Command.Group>
            )}

            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              {isEmpty
                ? query.trim().length >= 2
                  ? "Sin resultados."
                  : "Escribe para buscar o elige un destino."
                : ""}
            </Command.Empty>

            {hasEntities && (
              <Command.Group
                heading="Resultados"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/70"
              >
                {hits.map((hit) => (
                  <Item key={hit.id} onSelect={() => go(hit.href)}>
                    {hit.kind === "trip" ? (
                      <RiFlightTakeoffLine className="h-4 w-4" aria-hidden />
                    ) : hit.kind === "invoice" ? (
                      <RiFileTextLine className="h-4 w-4" aria-hidden />
                    ) : (
                      <RiTeamLine className="h-4 w-4" aria-hidden />
                    )}
                    <span className="flex-1 truncate">{hit.label}</span>
                    <span className="text-xs text-muted-foreground/70">{hit.hint}</span>
                  </Item>
                ))}
              </Command.Group>
            )}

            <Command.Group
              heading="Navegación"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/70"
            >
              {navMatches.map(({ item, hint }) => (
                <Item
                  key={`nav-${item.href}`}
                  onSelect={() => go(item.href)}
                  keywords={hint}
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-muted-foreground/70">{hint}</span>
                </Item>
              ))}
            </Command.Group>

            {actionMatches.length > 0 && (
              <Command.Group
                heading="Acciones"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/70"
              >
                {actionMatches.map((action) => (
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

          <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-xs text-muted-foreground/70">
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
      className="flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-foreground/75 transition-colors data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
    >
      {children}
    </Command.Item>
  );
}
