import { redirect } from "next/navigation";

import { TripForm } from "@/components/trips/trip-form";
import { getClientContext } from "@/lib/auth/tenant";
import {
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/lib/business/payment-methods";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("Solicitar viaje");

export default async function NewTripPage() {
  const ctx = await getClientContext();

  // CLIENT_FINANCE es read-only: no puede crear solicitudes.
  if (ctx.role !== "CLIENT_ADMIN") redirect("/trips");
  if (!ctx.tenantId) redirect("/trips");

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("payment_method")
    .eq("id", ctx.tenantId)
    .single();

  const method: PaymentMethod =
    (tenant?.payment_method as PaymentMethod | undefined) ?? "prepaid";

  const methodCopy: Record<PaymentMethod, string> = {
    cash: "Necesitarás transferir por SPEI antes de emitir. Te daremos la CLABE al confirmar la opción.",
    prepaid: "Se cobrará de tu saldo disponible.",
    credit: "Se cargará a tu línea de crédito (Sprint 2).",
  };

  return (
    <div className="flex max-w-[65ch] flex-col gap-8">
      <h1>Solicitar viaje</h1>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-foreground">
          Este viaje se pagará con:{" "}
          <span className="font-semibold">{PAYMENT_METHOD_LABEL[method]}</span>
        </p>
        <p className="mt-1 text-sm text-foreground/75">{methodCopy[method]}</p>
      </div>

      <TripForm userId={ctx.userId} tenantId={ctx.tenantId} />
    </div>
  );
}
