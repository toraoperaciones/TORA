"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const receiptSchema = z.object({
  amount: z.coerce.number().positive("Monto debe ser mayor a 0"),
  reference: z.string().optional(),
});

// z.coerce hace que input ≠ output en `amount`.
type ReceiptFormInput = z.input<typeof receiptSchema>;
type ReceiptFormOutput = z.output<typeof receiptSchema>;

export function ReceiptUpload({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReceiptFormInput, unknown, ReceiptFormOutput>({
    resolver: zodResolver(receiptSchema),
    defaultValues: { amount: undefined, reference: "" },
  });

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (selected && selected.size > MAX_FILE_BYTES) {
      toast.error("Archivo demasiado grande", {
        description: "El máximo permitido es 5 MB.",
      });
      event.target.value = "";
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function onSubmit(values: ReceiptFormOutput) {
    if (!file) {
      toast.error("Falta el comprobante", {
        description: "Adjunta el PDF o imagen del SPEI.",
      });
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    // Path esperado por las policies del bucket: {tenant_id}/{uuid}-{filename}
    const path = `${tenantId}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(path, file);

    if (uploadError) {
      toast.error("No se pudo subir el comprobante", {
        description: uploadError.message,
      });
      setSubmitting(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase
      .from("wallet_transactions")
      .insert({
        tenant_id: tenantId,
        amount: values.amount,
        type: "deposit",
        status: "pending",
        reference: values.reference || null,
        receipt_url: path,
        created_by: user?.id ?? null,
      });

    if (insertError) {
      toast.error("No se pudo registrar el depósito", {
        description: insertError.message,
      });
      setSubmitting(false);
      return;
    }

    toast.success("Comprobante enviado. Se validará en menos de 1 hora hábil.");
    setFile(null);
    reset();
    router.refresh();
  }

  return (
    <Card className="border-border-subtle bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="font-display text-h4 text-navy">
          Reportar depósito SPEI
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>
            Los depósitos se validan en menos de 1 hora hábil.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-file">Comprobante (PDF o imagen, máx. 5 MB)</Label>
            <Input
              id="receipt-file"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={onFileChange}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Monto (MXN)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="15000.00"
                className="tabular-nums"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-caption font-semibold text-navy">
                  {errors.amount.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reference">Referencia SPEI (opcional)</Label>
              <Input
                id="reference"
                type="text"
                placeholder="00518001234567"
                className="tabular-nums"
                {...register("reference")}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="font-display font-semibold"
          >
            {submitting ? "Enviando…" : "Enviar comprobante"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
