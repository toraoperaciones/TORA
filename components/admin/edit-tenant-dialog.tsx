"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { updateTenantAction } from "@/app/(admin)/admin/tenants/actions";
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
import {
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/lib/business/payment-method";

const editSchema = z.object({
  payment_method: z.enum(["cash", "prepaid", "credit"]),
  spei_clabe: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{18}$/.test(v), "CLABE debe tener 18 dígitos"),
  spei_beneficiary: z.string().optional(),
  credit_limit: z.coerce.number().min(0),
  credit_days: z.coerce.number().int().min(1).max(365),
});

type EditFormInput = z.input<typeof editSchema>;
type EditFormOutput = z.output<typeof editSchema>;

export function EditTenantDialog({
  tenantId,
  tenantName,
  paymentMethod,
  speiClabe,
  speiBeneficiary,
  creditLimit,
  creditDays,
}: {
  tenantId: string;
  tenantName: string;
  paymentMethod: PaymentMethod;
  speiClabe: string | null;
  speiBeneficiary: string | null;
  creditLimit: number;
  creditDays: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<EditFormInput, unknown, EditFormOutput>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      payment_method: paymentMethod,
      spei_clabe: speiClabe ?? "",
      spei_beneficiary: speiBeneficiary ?? "",
      credit_limit: creditLimit,
      credit_days: creditDays,
    },
  });

  // Sprint 2: el límite/días solo son editables para tenants a crédito.
  const isCredit = watch("payment_method") === "credit";

  async function onSubmit(values: EditFormOutput) {
    setSaving(true);
    const result = await updateTenantAction({
      tenant_id: tenantId,
      payment_method: values.payment_method,
      spei_clabe: values.spei_clabe || null,
      spei_beneficiary: values.spei_beneficiary || null,
      credit_limit: values.credit_limit,
      credit_days: values.credit_days,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error("No se pudo guardar", { description: result.error });
      return;
    }
    toast.success("Tenant actualizado.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-semibold">
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Editar {tenantName}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            Método de pago y datos SPEI. Los cambios quedan registrados en el
            historial del tenant.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Controller
            control={control}
            name="payment_method"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-method">Método de pago</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      ["cash", "prepaid", "credit"] as const
                    ).map((m) => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_METHOD_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-clabe">CLABE SPEI (18 dígitos)</Label>
            <Input
              id="edit-clabe"
              inputMode="numeric"
              placeholder="012180001234567890"
              className="tabular-nums"
              {...register("spei_clabe")}
            />
            {errors.spei_clabe && (
              <p className="text-xs font-semibold text-foreground">
                {errors.spei_clabe.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-beneficiary">Beneficiario SPEI</Label>
            <Input
              id="edit-beneficiary"
              placeholder="TORA SA de CV"
              {...register("spei_beneficiary")}
            />
          </div>

          {isCredit && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-credit-limit">Límite de crédito (MXN)</Label>
                <Input
                  id="edit-credit-limit"
                  type="number"
                  min="0"
                  step="1000"
                  className="tabular-nums"
                  {...register("credit_limit")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-credit-days">Días de crédito</Label>
                <Input
                  id="edit-credit-days"
                  type="number"
                  min="1"
                  max="365"
                  className="tabular-nums"
                  {...register("credit_days")}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="font-semibold"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="font-semibold">
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
