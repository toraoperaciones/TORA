import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Export JSON para timbrado manual: el contador externo sube este payload
 * al PAC (Facturapi, SW Sapien, etc.). NO integra ninguna API de facturación.
 *
 * Constantes CFDI 4.0 del emisor TORA (placeholders del CEO hasta tener
 * los datos definitivos):
 */
const EMISOR = {
  rfc: "TDR240101AAA",
  razon_social: "TORA SA de CV",
  regimen_fiscal: "601",
  domicilio_fiscal: "Ciudad de México, México",
};

const CLAVE_PROD_SERV = "90121500"; // Servicios de agencias de viajes
const CLAVE_UNIDAD = "E48"; // Unidad de servicio
const OBJETO_IMPUESTO = "02"; // Sí objeto de impuesto
const IVA_TASA = 0.16;
const USO_CFDI = "G03"; // Gastos en general

export interface InvoiceExportPayload {
  emisor: typeof EMISOR;
  receptor: {
    rfc: string;
    razon_social: string;
    regimen_fiscal: string;
    domicilio_fiscal: string;
    uso_cfdi: string;
  };
  concepto: {
    clave_prod_serv: string;
    cantidad: number;
    clave_unidad: string;
    unidad: string;
    descripcion: string;
    valor_unitario: number;
    importe: number;
    objeto_impuesto: string;
    iva_tasa: number;
    iva_importe: number;
  };
  totales: { subtotal: number; iva: number; total: number };
  metadata: {
    period: string;
    generated_at: string;
    trips_count: number;
    trips: Array<{
      id: string;
      destination: string;
      departure_date: string;
      service_type: string;
      final_price: number;
    }>;
  };
}

/**
 * Agrupa los trips del tenant en el período (YYYY-MM) y construye el CFDI
 * de servicios de gestión de viajes: una sola partida con la suma de los
 * precios finales (IVA 16% incluido en el total calculado).
 */
export async function buildInvoiceExport(
  tenantId: string,
  period: string
): Promise<InvoiceExportPayload> {
  const admin = createAdminClient();

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("rfc, razon_social, regimen_fiscal")
    .eq("id", tenantId)
    .single();
  if (tenantError || !tenant) {
    throw new Error(tenantError?.message ?? "Tenant no encontrado");
  }
  if (!tenant.rfc) {
    throw new Error("El tenant no tiene RFC capturado: captúralo en Admin → Tenants");
  }

  const from = `${period}-01`;
  const { data: trips, error: tripsError } = await admin
    .from("trips")
    .select(
      `id, destination, departure_date, service_type,
       options:trip_options (final_price, is_selected)`
    )
    .eq("tenant_id", tenantId)
    .gte("departure_date", from)
    .lt("departure_date", nextMonth(from))
    .order("departure_date");

  if (tripsError) throw new Error(tripsError.message);

  const detail = (trips ?? []).map((trip) => {
    const options = (trip.options ?? []) as Array<{
      final_price: number | null;
      is_selected: boolean | null;
    }>;
    const selected = options.find((o) => o.is_selected) ?? options[0];
    return {
      id: trip.id,
      destination: trip.destination,
      departure_date: trip.departure_date,
      service_type: trip.service_type,
      final_price: Number(selected?.final_price ?? 0),
    };
  });

  const subtotal = round2(
    detail.reduce((acc, trip) => acc + trip.final_price, 0)
  );
  const iva = round2(subtotal * IVA_TASA);
  const total = round2(subtotal + iva);

  return {
    emisor: EMISOR,
    receptor: {
      rfc: tenant.rfc,
      razon_social: tenant.razon_social ?? "",
      regimen_fiscal: tenant.regimen_fiscal ?? "601",
      domicilio_fiscal: "",
      uso_cfdi: USO_CFDI,
    },
    concepto: {
      clave_prod_serv: CLAVE_PROD_SERV,
      cantidad: 1,
      clave_unidad: CLAVE_UNIDAD,
      unidad: "Unidad de servicio",
      descripcion: `Servicios de gestión de viajes - ${period}`,
      valor_unitario: subtotal,
      importe: subtotal,
      objeto_impuesto: OBJETO_IMPUESTO,
      iva_tasa: IVA_TASA,
      iva_importe: iva,
    },
    totales: { subtotal, iva, total },
    metadata: {
      period,
      generated_at: new Date().toISOString(),
      trips_count: detail.length,
      trips: detail,
    },
  };
}

function nextMonth(from: string): string {
  const [year, month] = from.split("-").map(Number);
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return `${next.y}-${String(next.m).padStart(2, "0")}-01`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
