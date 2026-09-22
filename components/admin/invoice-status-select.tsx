"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateInvoiceStatusAction } from "@/app/(admin)/admin/invoices/actions";

const STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "issued", label: "Emitida" },
  { value: "paid", label: "Pagada" },
  { value: "cancelled", label: "Cancelada" },
] as const;

export function InvoiceStatusSelect({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    setSaving(true);
    const result = await updateInvoiceStatusAction(
      invoiceId,
      next as "draft" | "issued" | "paid" | "cancelled"
    );
    setSaving(false);
    if (!result.ok) {
      toast.error("No se pudo actualizar", { description: result.error });
      return;
    }
    setValue(next);
    toast.success("Estado actualizado.");
    router.refresh();
  }

  return (
    <Select value={value} onValueChange={(v) => void change(v)} disabled={saving}>
      <SelectTrigger className="h-8 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
