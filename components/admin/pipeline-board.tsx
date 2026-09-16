"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { moveLeadAction, type LeadStage } from "@/app/(admin)/admin/pipeline/actions";
import { LeadDetailDialog } from "@/components/admin/lead-detail-dialog";
import { LeadFormDialog, type LeadInput } from "@/components/admin/lead-form-dialog";
import { formatMXN } from "@/lib/utils";

const STAGE_COLUMNS: { key: LeadStage; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "demo", label: "Demo" },
  { key: "pilot", label: "Pilot" },
  { key: "client", label: "Active Client" },
];

export interface BoardLead extends LeadInput {
  id: string;
  last_contact_at: string | null;
  updated_at: string;
}

export function PipelineBoard({ initialLeads }: { initialLeads: BoardLead[] }) {
  const [leads, setLeads] = useState<BoardLead[]>(initialLeads);
  const [moving, setMoving] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function moveLead(lead: BoardLead, direction: 1 | -1) {
    const idx = STAGE_COLUMNS.findIndex((s) => s.key === lead.stage);
    const next = STAGE_COLUMNS[idx + direction];
    if (!next) return;

    const previous = leads;
    setMoving(lead.id);
    // Actualización optimista
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id ? { ...l, stage: next.key, last_contact_at: new Date().toISOString() } : l
      )
    );

    const result = await moveLeadAction(lead.id, next.key);
    setMoving(null);

    if (!result.ok) {
      toast.error("No se pudo mover el lead", { description: result.error });
      setLeads(previous); // revert
      return;
    }
  }

  function columnTotal(stage: LeadStage): number {
    return leads
      .filter((l) => l.stage === stage)
      .reduce((acc, l) => acc + (l.estimated_monthly_spend ?? 0), 0);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-body-s text-graphite">
          {leads.length} leads · total estimado{" "}
          <span className="tabular-nums font-semibold text-navy">
            {formatMXN(leads.reduce((acc, l) => acc + (l.estimated_monthly_spend ?? 0), 0))}
          </span>{" "}
          /mes
        </p>
        <Button className="border-transparent bg-forest font-display font-semibold text-offwhite hover:bg-forest-hover" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo lead
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGE_COLUMNS.map((col) => {
          const columnLeads = leads.filter((l) => l.stage === col.key);
          return (
            <div
              key={col.key}
              className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-offwhite/50 p-3"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-h5 text-navy">{col.label}</h2>
                <span className="text-caption text-graphite">
                  {columnLeads.length} ·{" "}
                  <span className="tabular-nums">{formatMXN(columnTotal(col.key))}</span>
                </span>
              </div>

              {columnLeads.length === 0 ? (
                <p className="text-caption text-graphite">Sin leads</p>
              ) : (
                columnLeads.map((lead) => (
                  <LeadDetailDialog
                    key={lead.id}
                    lead={lead}
                    trigger={
                      <button
                        type="button"
                        disabled={moving === lead.id}
                        className="w-full rounded-lg border border-border-subtle bg-offwhite p-4 text-left transition-colors hover:border-navy/30"
                      >
                        <p className="font-display text-h4 text-navy">{lead.company_name}</p>
                        {lead.contact_name && (
                          <p className="text-body-s text-graphite">{lead.contact_name}</p>
                        )}
                        <p className="text-caption text-graphite">{lead.contact_email ?? "—"}</p>
                        <p className="mt-2 tabular-nums text-body-s font-semibold text-navy">
                          {formatMXN(lead.estimated_monthly_spend ?? 0)}
                        </p>
                        <p className="text-caption text-graphite">
                          {lead.last_contact_at ? timeAgoEs(lead.last_contact_at) : "Sin contacto"}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={lead.stage === "lead" || moving === lead.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void moveLead(lead, -1);
                            }}
                            className="h-8 px-2 font-display font-semibold"
                            aria-label="Mover a la etapa anterior"
                          >
                            ←
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={lead.stage === "client" || moving === lead.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void moveLead(lead, 1);
                            }}
                            className="h-8 px-2 font-display font-semibold"
                            aria-label="Mover a la etapa siguiente"
                          >
                            →
                          </Button>
                        </div>
                      </button>
                    }
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      <LeadFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function timeAgoEs(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "hace minutos";
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}
