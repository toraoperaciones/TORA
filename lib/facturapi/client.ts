import "server-only";

/**
 * Cliente Facturapi v2 (REST, fetch nativo — sin dependencias nuevas).
 * Doc: https://docs.facturapi.io
 *
 * La API key (sk_test_… / sk_live_…) vive en FACTURAPI_API_KEY (Vercel).
 * Cada organización emisora tiene su facturapi_organization_id en
 * issuer_companies; toda llamada va dirigida a una organización específica.
 */

const BASE = "https://www.facturapi.io/v2";

export class FacturapiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function facturapiFetch<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const key = process.env.FACTURAPI_API_KEY;
  if (!key) {
    throw new FacturapiError(
      "FACTURAPI_API_KEY no está configurada (Vercel: entorno producción).",
      0
    );
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Sin caché: las respuestas de timbrado son mutaciones.
    cache: "no-store",
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new FacturapiError(
      `Facturapi ${method} ${path} → ${res.status}: ${raw.slice(0, 300)}`,
      res.status
    );
  }
  return (raw ? JSON.parse(raw) : {}) as T;
}

// ── Organizaciones (emisoras) ────────────────────────────────────────────

export interface FacturapiOrg {
  id: string;
  legal_name: string;
  tax_id: string;
}

/** Crea la organización emisora en Facturapi (una por razón social). */
export function createOrganization(input: {
  legal_name: string;
  tax_id: string;
  zip: string;
}): Promise<FacturapiOrg> {
  return facturapiFetch<FacturapiOrg>("POST", "/organizations", {
    legal_name: input.legal_name,
    tax_id: input.tax_id,
    zip: input.zip,
  });
}

export function getOrganization(id: string): Promise<FacturapiOrg> {
  return facturapiFetch<FacturapiOrg>("GET", `/organizations/${id}`);
}

/** Sube el CSD (cer/key en base64 + password) a la organización. */
export function uploadCertificate(
  orgId: string,
  input: { cer_b64: string; key_b64: string; password: string }
): Promise<FacturapiOrg> {
  return facturapiFetch<FacturapiOrg>(
    "POST",
    `/organizations/${orgId}/certificate`,
    input
  );
}

// ── Facturas (CFDI 4.0) ──────────────────────────────────────────────────

export interface FacturapiInvoiceItem {
  quantity: number;
  product: {
    description: string;
    product_key: string; // 90121500 — servicios de agencias de viajes
    unit_key: string; // E48 — unidad de servicio
    price: number; // precio unitario SIN IVA
    tax_included: boolean;
    taxes: Array<{ type: "IVA"; rate: number }>;
  };
}

export interface FacturapiCustomer {
  legal_name: string;
  tax_id: string;
  tax_system: string; // régimen fiscal del receptor
  address: { zip: string };
}

export interface FacturapiInvoice {
  id: string;
  uuid?: string;
  status: string;
  verification_url?: string;
}

/** Emite el CFDI con el comprobante del período (receiver = cliente TORA). */
export function createInvoice(
  orgId: string,
  input: {
    customer: FacturapiCustomer;
    items: FacturapiInvoiceItem[];
    use: string; // uso CFDI (G03)
    payment_form: string; // forma_pago (03 transferencia)
    payment_method: string; // metodo_pago (PUE)
    due_date?: string;
  }
): Promise<FacturapiInvoice> {
  return facturapiFetch<FacturapiInvoice>("POST", "/invoices", {
    organization: orgId,
    customer: input.customer,
    items: input.items,
    use: input.use,
    payment_form: input.payment_form,
    payment_method: input.payment_method,
    ...(input.due_date ? { due_date: input.due_date } : {}),
  });
}

/** PDF/ZIP del CFDI timbrado (binarios). */
export async function downloadInvoicePdf(
  invoiceId: string
): Promise<ArrayBuffer> {
  const key = process.env.FACTURAPI_API_KEY;
  if (!key) throw new FacturapiError("FACTURAPI_API_KEY no configurada", 0);
  const res = await fetch(`${BASE}/invoices/${invoiceId}/pdf`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new FacturapiError(`Facturapi pdf → ${res.status}`, res.status);
  }
  return res.arrayBuffer();
}

/** Cancela un CFDI (motivo por defecto 02 — comprobante emitido con errores). */
export function cancelInvoice(invoiceId: string): Promise<FacturapiInvoice> {
  return facturapiFetch<FacturapiInvoice>(
    "POST",
    `/invoices/${invoiceId}/cancel`,
    { motive: "02" }
  );
}
