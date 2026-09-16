import { createClient } from "@/lib/supabase/server";
import { PipelineBoard, type BoardLead } from "@/components/admin/pipeline-board";
import type { LeadStage } from "@/app/(admin)/admin/pipeline/actions";

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("pipeline_leads")
    .select("*")
    .order("updated_at", { ascending: false });

  const boardLeads: BoardLead[] = (leads ?? []).map((lead) => ({
    id: lead.id,
    company_name: lead.company_name,
    contact_name: lead.contact_name,
    contact_email: lead.contact_email,
    contact_phone: lead.contact_phone,
    stage: lead.stage as LeadStage,
    estimated_monthly_spend: lead.estimated_monthly_spend,
    notes: lead.notes,
    last_contact_at: lead.last_contact_at,
    updated_at: lead.updated_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h2 text-navy">Pipeline comercial</h1>
      <PipelineBoard initialLeads={boardLeads} />
    </div>
  );
}
