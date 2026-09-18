"use client";

import { createClient } from "@/lib/supabase/client";
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
import { createInvoiceAction } from "@/app/(admin)/admin/invoices/actions";

const invoiceSchema = z.object({
  tenantId: z.string().uuid("Selecciona un tenant"),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM"),
  subtotal: z.coerce.number().positive("Subtotal debe ser mayor a 0"),
  iva: z.coerce.number().min(0),
  cfdiUuid: z.string().optional(),
});

type InvoiceFormInput = z.input<typeof invoiceSchema>;
type InvoiceFormOutput = z.output<typeof invoiceSchema>;

const PDF_MAX = 5 * 1024 * 1024;
const XML_MAX = 1 * 1024 * 1024;

export function InvoiceUploadDialog({
  tenants,
}: {
  tenants: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormInput, unknown, InvoiceFormOutput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { period: "", iva: undefined, cfdiUuid: "" },
  });

  const subtotal = Number(watch("subtotal") || 0);
  const ivaValue = watch("iva");
  const total = ivaValue !== undefined && ivaValue !== null && `${ivaValue}` !== ""
    ? subtotal + Number(ivaValue)
    : subtotal * 1.16;

  async function onFile(kind: "pdf" | "xml", file: File | null) {
    if (!file) return;
    const max = kind === "pdf" ? PDF_MAX : XML_MAX;
    if (file.size > max) {
      toast.error(`El archivo ${kind.toUpperCase()} excede el máximo de ${max / (1024 * 1024)}MB`);
      return;
    }
    if (kind === "pdf") setPdfFile(file);
    else setXmlFile(file);
  }

  async function onSubmit(values: InvoiceFormOutput) {
    if (!pdfFile) {
      toast.error("Adjunta el PDF de la factura");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const uuid = crypto.randomUUID();
      const base = `${values.tenantId}/${values.period}`;

      const pdfPath = `${base}/${uuid}-factura.pdf`;
      const { error: pdfErr } = await supabase.storage
        .from("invoices")
        .upload(pdfPath, pdfFile);
      if (pdfErr) throw new Error(`PDF: ${pdfErr.message}`);

      let xmlPath: string | null = null;
      if (xmlFile) {
        xmlPath = `${base}/${uuid}-factura.xml`;
        const { error: xmlErr } = await supabase.storage
          .from("invoices")
          .upload(xmlPath, xmlFile);
        if (xmlErr) throw new Error(`XML: ${xmlErr.message}`);
      }

      const result = await createInvoiceAction({
        tenantId: values.tenantId,
        period: values.period,
        subtotal: values.subtotal,
        iva: values.iva,
        total,
        cfdiUuid: values.cfdiUuid || null,
        pdfPath,
        xmlPath,
      });
      if (!result.ok) throw new Error(result.error ?? "No se pudo registrar la factura");

      toast.success("Factura subida.");
      setOpen(false);
      reset();
      setPdfFile(null);
      setXmlFile(null);
      router.refresh();
    } catch (err) {
      toast.error("No se pudo subir la factura", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-display font-semibold">Subir factura</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-h4 text-text-primary">Subir factura</DialogTitle>
          <DialogDescription className="text-body-s text-text-secondary">
            PDF + XML al bucket privado `invoices`. El cliente solo puede leerlos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Tenant</Label>
            <Select onValueChange={(v) => setValue("tenantId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tenantId && (
              <p className="text-caption font-semibold text-text-primary">{errors.tenantId.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-period">Período (YYYY-MM)</Label>
              <Input id="inv-period" placeholder="2025-03" {...register("period")} />
              {errors.period && (
                <p className="text-caption font-semibold text-text-primary">{errors.period.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-cfdi">CFDI UUID (opcional)</Label>
              <Input id="inv-cfdi" {...register("cfdiUuid")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-subtotal">Subtotal (MXN)</Label>
              <Input
                id="inv-subtotal"
                type="number"
                min="0"
                step="0.01"
                className="tabular-nums"
                {...register("subtotal")}
              />
              {errors.subtotal && (
                <p className="text-caption font-semibold text-text-primary">{errors.subtotal.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-iva">IVA (default 16%)</Label>
              <Input
                id="inv-iva"
                type="number"
                min="0"
                step="0.01"
                className="tabular-nums"
                {...register("iva", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
          </div>

          <div className="text-caption text-text-secondary">
            Total calculado: <span className="tabular-nums font-semibold text-text-primary">${total.toFixed(2)} MXN</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-pdf">PDF (máx. 5MB)</Label>
              <Input
                id="inv-pdf"
                type="file"
                accept="application/pdf"
                onChange={(e) => void onFile("pdf", e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-xml">XML (máx. 1MB, opcional)</Label>
              <Input
                id="inv-xml"
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={(e) => void onFile("xml", e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="font-display font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="font-display font-semibold">
              {saving ? "Subiendo…" : "Subir factura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
