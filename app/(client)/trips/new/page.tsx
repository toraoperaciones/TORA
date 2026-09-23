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
import { formatMXN } from "@/lib/utils";

export const metadata: Metadata = pageMetadata("Solicitar viaje");

export default async function NewTripPage() {
  const ctx = await getClientContext();

  // CLIENT_FINANCE es read-only: no puede crear solicitudes.
  if (ctx.role !== "CLIENT_ADMIN") redirect("/trips");
  if (!ctx.tenantId) redirect("/trips");

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("payment_method, credit_limit, credit_used")
    .eq("id", ctx.tenantId)
    .single();

  const method: PaymentMethod =
    (tenant?.payment_method as PaymentMethod | undefined) ?? "prepaid";

  // Sprint 2 — disponible real para la copia de crédito.
  const creditAvailable = Math.max(
    0,
    Number(tenant?.credit_limit ?? 0) - Number(tenant?.credit_used ?? 0)
  );
  const creditLimit = Number(tenant?.credit_limit ?? 0);

  const methodCopy: Record<PaymentMethod, string> = {
    cash: "Necesitarás transferir por SPEI antes de emitir. Te daremos la CLABE al confirmar la opción.",
    prepaid: "Se cobrará de tu saldo disponible.",
    credit:
      creditLimit > 0
        ? `Se cargará a tu línea de crédito. Disponible: ${formatMXN(creditAvailable)} de ${formatMXN(creditLimit)}.`
        : "Se cargará a tu línea de crédito.",
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
        {method === "credit" && creditAvailable <= 0 && (
          <p className="mt-2 text-sm font-semibold text-destructive">
            Sin crédito disponible. Contacta a TORA.
          </p>
        )}
      </div>

      <TripForm userId={ctx.userId} tenantId={ctx.tenantId} />
    </div>
  );
}
