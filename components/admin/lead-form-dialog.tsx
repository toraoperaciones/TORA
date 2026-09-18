"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { Input } from "@/components/ui/input";
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
  createLeadAction,
  updateLeadAction,
  type LeadStage,
} from "@/app/(admin)/admin/pipeline/actions";

export const STAGES: { key: LeadStage; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "demo", label: "Demo" },
  { key: "pilot", label: "Pilot" },
  { key: "client", label: "Active Client" },
];

const leadSchema = z.object({
  companyName: z.string().min(2, "Empresa requerida (mín. 2 caracteres)"),
  contactName: z.string().optional(),
  contactEmail: z
    .string()
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email inválido"),
  contactPhone: z.string().optional(),
  estimatedMonthlySpend: z.coerce.number().min(0),
  notes: z.string().optional(),
  stage: z.enum(["lead", "demo", "pilot", "client"]),
});

type LeadFormInput = z.input<typeof leadSchema>;
type LeadFormOutput = z.output<typeof leadSchema>;

export interface LeadInput {
  id?: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: LeadStage;
  estimated_monthly_spend: number | null;
  notes: string | null;
}

export function LeadFormDialog({
  lead,
  trigger,
  defaultStage = "lead",
  open: openProp,
  onOpenChange,
}: {
  lead?: LeadInput;
  trigger?: React.ReactNode;
  defaultStage?: LeadStage;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const [saving, setSaving] = useState(false);

  const controlled = openProp !== undefined && onOpenChange !== undefined;
  const open = controlled ? openProp! : openState;
  const setOpen = (v: boolean) => {
    if (controlled) onOpenChange!(v);
    else setOpenState(v);
  };

  const isEdit = Boolean(lead?.id);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LeadFormInput, unknown, LeadFormOutput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      companyName: lead?.company_name ?? "",
      contactName: lead?.contact_name ?? "",
      contactEmail: lead?.contact_email ?? "",
      contactPhone: lead?.contact_phone ?? "",
      estimatedMonthlySpend: lead?.estimated_monthly_spend ?? 0,
      notes: lead?.notes ?? "",
      stage: lead?.stage ?? defaultStage,
    },
  });

  const stage = watch("stage");

  async function onSubmit(values: LeadFormOutput) {
    setSaving(true);
    const payload = {
      companyName: values.companyName,
      contactName: values.contactName || null,
      contactEmail: values.contactEmail || null,
      contactPhone: values.contactPhone || null,
      estimatedMonthlySpend: values.estimatedMonthlySpend,
      notes: values.notes || null,
      stage: values.stage,
    };

    const result = isEdit
      ? await updateLeadAction({ id: lead!.id!, ...payload })
      : await createLeadAction(payload);
    setSaving(false);

    if (!result.ok) {
      toast.error("No se pudo guardar el lead", { description: result.error });
      return;
    }
    toast.success(isEdit ? "Lead actualizado." : "Lead creado.");
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-h4 text-foreground">
            {isEdit ? "Editar lead" : "Nuevo lead"}
          </DialogTitle>
          <DialogDescription className="text-body-s text-foreground/75">
            CRM básico de prospectos antes de convertirse en tenant.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-company">Empresa</Label>
            <Input id="lead-company" placeholder="Grupo Industrial Saltillo" {...register("companyName")} />
            {errors.companyName && (
              <p className="text-caption font-semibold text-foreground">{errors.companyName.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-contact">Contacto</Label>
              <Input id="lead-contact" {...register("contactName")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-phone">Teléfono</Label>
              <Input id="lead-phone" {...register("contactPhone")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-email">Email</Label>
            <Input id="lead-email" type="email" {...register("contactEmail")} />
            {errors.contactEmail && (
              <p className="text-caption font-semibold text-foreground">{errors.contactEmail.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-spend">Gasto mensual estimado (MXN)</Label>
              <Input
                id="lead-spend"
                type="number"
                min="0"
                step="1000"
                className="tabular-nums"
                {...register("estimatedMonthlySpend")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Etapa</Label>
              <Select value={stage} onValueChange={(v) => setValue("stage", v as LeadStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-notes">Notas</Label>
            <Textarea id="lead-notes" rows={3} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="font-display font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="font-display font-semibold">
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
