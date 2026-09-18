import { redirect } from "next/navigation";

import { TripForm } from "@/components/trips/trip-form";
import { getClientContext } from "@/lib/auth/tenant";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("Solicitar viaje");

export default async function NewTripPage() {
  const ctx = await getClientContext();

  // CLIENT_FINANCE es read-only: no puede crear solicitudes.
  if (ctx.role !== "CLIENT_ADMIN") redirect("/trips");
  if (!ctx.tenantId) redirect("/trips");

  return (
    <div className="flex max-w-[65ch] flex-col gap-8">
      <h1>Solicitar viaje</h1>
      <TripForm userId={ctx.userId} tenantId={ctx.tenantId} />
    </div>
  );
}
