"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { createTenantAction } from "@/app/(admin)/admin/tenants/actions";

const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

const tenantSchema = z.object({
  name: z.string().min(2, "Nombre requerido (mín. 2 caracteres)"),
  rfc: z
    .string()
    .optional()
    .refine((v) => !v || rfcRegex.test(v.toUpperCase()), "RFC inválido (ej. GSA240101XYZ)"),
  razon_social: z.string().optional(),
  regimen_fiscal: z.string().optional(),
  credit_limit: z.coerce.number().min(0),
  credit_days: z.coerce.number().int().min(0).max(365),
  markup_flights: z.coerce.number().min(0).max(1),
  markup_hotels: z.coerce.number().min(0).max(1),
  markup_cars: z.coerce.number().min(0).max(1),
  markup_stands: z.coerce.number().min(0).max(1),
  notes: z.string().optional(),
});

type TenantFormInput = z.input<typeof tenantSchema>;
type TenantFormOutput = z.output<typeof tenantSchema>;

const PERCENT_FIELDS = [
  { name: "markup_flights", label: "Vuelos (%)", defaultPct: 6 },
  { name: "markup_hotels", label: "Hoteles (%)", defaultPct: 10 },
  { name: "markup_cars", label: "Autos (%)", defaultPct: 12 },
  { name: "markup_stands", label: "Stands (%)", defaultPct: 30 },
] as const;

export function TenantFormDialog() {
  const searchParams = useSearchParams();
  // Prefill desde pipeline: /admin/tenants?from_lead=<id>&name=<empresa>
  const prefillName = searchParams.get("name") ?? "";

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TenantFormInput, unknown, TenantFormOutput>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      name: prefillName,
      rfc: "",
      razon_social: "",
      regimen_fiscal: "",
      credit_limit: 0,
      credit_days: 30,
      markup_flights: 0.06,
      markup_hotels: 0.1,
      markup_cars: 0.12,
      markup_stands: 0.3,
      notes: "",
    },
  });

  async function onSubmit(values: TenantFormOutput) {
    setSaving(true);
    const result = await createTenantAction({
      name: values.name,
      rfc: values.rfc?.toUpperCase() || null,
      razon_social: values.razon_social || null,
      regimen_fiscal: values.regimen_fiscal || null,
      credit_limit: values.credit_limit,
      credit_days: values.credit_days,
      markup_flights: values.markup_flights,
      markup_hotels: values.markup_hotels,
      markup_cars: values.markup_cars,
      markup_stands: values.markup_stands,
      notes: values.notes || null,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error("No se pudo crear el tenant", { description: result.error });
      return;
    }
    toast.success("Tenant creado.");
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-display font-semibold">Nuevo tenant</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-h4 text-foreground">
            Nuevo tenant
          </DialogTitle>
          <DialogDescription className="text-body-s text-foreground/75">
            Alta de cliente corporativo. Los markups definen el margen embebido.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="tenant-name">Nombre</Label>
            <Input id="tenant-name" placeholder="Grupo Salinas SA de CV" {...register("name")} />
            {errors.name && (
              <p className="text-caption font-semibold text-foreground">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tenant-rfc">RFC (opcional)</Label>
            <Input id="tenant-rfc" placeholder="GSA240101XYZ" {...register("rfc")} />
            {errors.rfc && (
              <p className="text-caption font-semibold text-foreground">{errors.rfc.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tenant-regimen">Régimen fiscal (opcional)</Label>
            <Input id="tenant-regimen" placeholder="601" {...register("regimen_fiscal")} />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="tenant-razon">Razón social (opcional)</Label>
            <Input id="tenant-razon" {...register("razon_social")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tenant-credit">Línea de crédito (MXN)</Label>
            <Input
              id="tenant-credit"
              type="number"
              min="0"
              step="1000"
              className="tabular-nums"
              {...register("credit_limit")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tenant-credit-days">Días de crédito</Label>
            <Input
              id="tenant-credit-days"
              type="number"
              min="0"
              max="365"
              className="tabular-nums"
              {...register("credit_days")}
            />
          </div>

          {PERCENT_FIELDS.map((field) => (
            <div key={field.name} className="flex flex-col gap-2">
              <Label htmlFor={`tenant-${field.name}`}>{field.label}</Label>
              <Input
                id={`tenant-${field.name}`}
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="tabular-nums"
                {...register(field.name, {
                  setValueAs: (v) => Number(v) / 100,
                })}
              />
              {errors[field.name] && (
                <p className="text-caption font-semibold text-foreground">
                  {errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="tenant-notes">Notas (opcional)</Label>
            <Textarea id="tenant-notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="font-display font-semibold"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="font-display font-semibold">
              {saving ? "Creando…" : "Crear tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
