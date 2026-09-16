/**
 * TORA — Seed de demo (corre con SERVICE ROLE, bypasea RLS).
 *
 * Uso:  pnpm seed
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 *
 * Idempotente: borra datos demo previos antes de insertar.
 * El trigger `handle_new_user` crea la fila en public.users automáticamente;
 * después el script asigna tenant y status active.
 */
import { config } from "dotenv";
import "../lib/polyfill-websocket";
import { createAdminClient } from "../lib/supabase/admin";

config({ path: ".env.local" });

// ── Validación de entorno ─────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "\n✗ Faltan variables de entorno.\n" +
      "  Copia .env.local.example → .env.local y llena:\n" +
      "    NEXT_PUBLIC_SUPABASE_URL\n" +
      "    SUPABASE_SERVICE_ROLE_KEY\n"
  );
  process.exit(1);
}

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const DEMO_PASSWORD = "Tora2025!";

const admin = createAdminClient();

// ── Helpers ───────────────────────────────────────────────────
function assert<T>(data: T | null, error: { message: string } | null, ctx: string): T {
  if (error) throw new Error(`[${ctx}] ${error.message}`);
  if (data === null) throw new Error(`[${ctx}] respuesta vacía`);
  return data;
}

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── 1. Limpieza (idempotencia) ────────────────────────────────
async function cleanup() {
  console.log("→ Limpiando datos previos…");

  // Orden FK: hojas → raíces.
  for (const [table, ctx] of [
    ["bookings", "cleanup/bookings"],
    ["trip_options", "cleanup/trip_options"],
    ["trips", "cleanup/trips"],
    ["wallet_transactions", "cleanup/wallet"],
    ["invoices", "cleanup/invoices"],
    ["tenants", "cleanup/tenants"],
  ] as const) {
    const { error } = await admin.from(table).delete().neq("id", ZERO_UUID);
    if (error) throw new Error(`[${ctx}] ${error.message}`);
  }

  // Auth users (cascade borra public.users vía FK).
  let page = 1;
  let deleted = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 500 });
    if (error) throw new Error(`[cleanup/auth-list] ${error.message}`);
    if (!data.users.length) break;
    for (const u of data.users) {
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) throw new Error(`[cleanup/auth-delete ${u.email}] ${delErr.message}`);
      deleted++;
    }
    page++;
  }
  console.log(`  ✓ ${deleted} auth users eliminados`);
}

// ── 2. Tenants ────────────────────────────────────────────────
async function createTenants() {
  console.log("→ Creando tenants…");
  const rows = [
    {
      name: "TORA Demo SA de CV",
      rfc: "TDE240101AAA",
      razon_social: "TORA Demo Sociedad Anónima de Capital Variable",
      regimen_fiscal: "601",
      credit_limit: 0,
      credit_days: 0,
      markup_flights: 0.06,
      markup_hotels: 0.1,
      markup_cars: 0.12,
      markup_stands: 0.3,
      notes: "Tenant interno para demos y pruebas.",
    },
    {
      name: "Acero del Norte SA de CV",
      rfc: "ANO120515BBB",
      razon_social: "Acero del Norte Sociedad Anónima de Capital Variable",
      regimen_fiscal: "601",
      credit_limit: 250000,
      credit_days: 30,
      // Markups del brief (Fase 5): 7% vuelos / 11% hoteles / 13% autos / 32% stands.
      markup_flights: 0.07,
      markup_hotels: 0.11,
      markup_cars: 0.13,
      markup_stands: 0.32,
      notes: "Cliente industrial, viajeros frecuentes Monterrey–CDMX.",
    },
    {
      name: "Viajes Corporativos MX SA de CV",
      rfc: "VCM180920CCC",
      razon_social: "Viajes Corporativos MX Sociedad Anónima de Capital Variable",
      regimen_fiscal: "612",
      credit_limit: 100000,
      credit_days: 15,
      markup_flights: 0.07,
      markup_hotels: 0.12,
      markup_cars: 0.14,
      markup_stands: 0.32,
      notes: "Agencia asociada, volúmenes medianos.",
    },
  ];

  const { data, error } = await admin.from("tenants").insert(rows).select();
  const tenants = assert(data, error, "createTenants");
  console.log(`  ✓ ${tenants.length} tenants creados`);
  return Object.fromEntries(tenants.map((t) => [t.name, t.id])) as Record<string, string>;
}

// ── 3. Usuarios auth + filas public.users ─────────────────────
const USERS = [
  { email: "admin@tora.mx",     role: "TORA_ADMIN",    full_name: "Alejandro Treviño", tenant: null,               phone: "+52 81 0000 0001" },
  { email: "ops@tora.mx",       role: "TORA_OPS",      full_name: "Mariana López",     tenant: null,               phone: "+52 81 0000 0002" },
  { email: "finanzas@tora.mx",  role: "TORA_FINANCE",  full_name: "Diego Ramírez",     tenant: null,               phone: "+52 81 0000 0003" },
  { email: "admin@aceronorte.mx",   role: "CLIENT_ADMIN",   full_name: "Carlos Mendoza",  tenant: "Acero del Norte SA de CV", phone: "+52 81 0000 0010" },
  { email: "finanzas@aceronorte.mx", role: "CLIENT_FINANCE", full_name: "Lucía Fernández", tenant: "Acero del Norte SA de CV", phone: "+52 81 0000 0011" },
  { email: "admin@vcm.mx",      role: "CLIENT_ADMIN",   full_name: "Jorge Villalobos", tenant: "Viajes Corporativos MX SA de CV", phone: "+52 55 0000 0020" },
  { email: "finanzas@vcm.mx",   role: "CLIENT_FINANCE", full_name: "Paola Gutiérrez",  tenant: "Viajes Corporativos MX SA de CV", phone: "+52 55 0000 0021" },
] as const;

async function createUsers(tenants: Record<string, string>) {
  console.log("→ Creando usuarios auth…");
  const idByEmail: Record<string, string> = {};

  for (const u of USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { role: u.role, full_name: u.full_name },
    });
    if (error) throw new Error(`[createUser ${u.email}] ${error.message}`);
    if (!data.user) throw new Error(`[createUser ${u.email}] sin usuario`);
    idByEmail[u.email] = data.user.id;
  }

  // El trigger ya insertó las filas; asignamos tenant/phone/status.
  for (const u of USERS) {
    const { error } = await admin
      .from("users")
      .update({
        tenant_id: u.tenant ? tenants[u.tenant] : null,
        phone: u.phone,
        status: "active",
      })
      .eq("id", idByEmail[u.email]);
    if (error) throw new Error(`[update user ${u.email}] ${error.message}`);
  }
  console.log(`  ✓ ${USERS.length} usuarios creados y activados`);
  return { idByEmail, emailByRole: Object.fromEntries(USERS.map((u) => [u.role, u.email])) as Record<string, string> };
}

// ── 4. Trips + options ────────────────────────────────────────
async function createTrips(tenants: Record<string, string>, idByEmail: Record<string, string>) {
  console.log("→ Creando trips…");
  const aceroAdmin = idByEmail["admin@aceronorte.mx"];
  const vcmAdmin = idByEmail["admin@vcm.mx"];
  const demoAdmin = idByEmail["admin@tora.mx"];

  const rows = [
    { tenant: "Acero del Norte SA de CV", requester: aceroAdmin, status: "pending_quote", origin: "Monterrey", destination: "Ciudad de México", departure_date: dayOffset(14), return_date: dayOffset(17), passengers: 1, service_type: "flight", reason: "Reunión con cliente steel", urgency: "normal" },
    { tenant: "Acero del Norte SA de CV", requester: aceroAdmin, status: "options_sent", origin: "Monterrey", destination: "Guadalajara", departure_date: dayOffset(21), return_date: dayOffset(24), passengers: 2, service_type: "hotel", reason: "Convención anual de ventas", urgency: "normal" },
    { tenant: "Acero del Norte SA de CV", requester: aceroAdmin, status: "awaiting_selection", origin: "Ciudad de México", destination: "Monterrey", departure_date: dayOffset(10), return_date: dayOffset(12), passengers: 1, service_type: "flight", reason: "Auditoría planta Apodaca", urgency: "urgent" },
    { tenant: "Acero del Norte SA de CV", requester: aceroAdmin, status: "awaiting_payment", origin: "Monterrey", destination: "Querétaro", departure_date: dayOffset(28), return_date: dayOffset(30), passengers: 3, service_type: "mixed", reason: "Visita proveedor", urgency: "normal" },
    { tenant: "Acero del Norte SA de CV", requester: aceroAdmin, status: "confirmed", origin: "Monterrey", destination: "Ciudad de México", departure_date: dayOffset(7), return_date: dayOffset(9), passengers: 1, service_type: "hotel", reason: "Feria Aeroespacial", urgency: "normal" },
    { tenant: "Viajes Corporativos MX SA de CV", requester: vcmAdmin, status: "options_sent", origin: "Ciudad de México", destination: "Cancún", departure_date: dayOffset(35), return_date: dayOffset(40), passengers: 4, service_type: "flight", reason: "Incentivo equipo comercial", urgency: "normal" },
    { tenant: "Viajes Corporativos MX SA de CV", requester: vcmAdmin, status: "completed", origin: "Ciudad de México", destination: "Mérida", departure_date: dayOffset(-20), return_date: dayOffset(-17), passengers: 2, service_type: "hotel", reason: "Capacitación regional", urgency: "normal" },
    { tenant: "TORA Demo SA de CV", requester: demoAdmin, status: "pending_quote", origin: "Ciudad de México", destination: "Guadalajara", departure_date: dayOffset(45), return_date: dayOffset(48), passengers: 1, service_type: "stand", reason: "Stand Expo Manufactura", urgency: "normal" },
  ] as const;

  const { data, error } = await admin.from("trips").insert(rows.map((r) => ({
    tenant_id: tenants[r.tenant],
    requester_id: r.requester,
    status: r.status,
    origin: r.origin,
    destination: r.destination,
    departure_date: r.departure_date,
    return_date: r.return_date,
    passengers: r.passengers,
    service_type: r.service_type,
    reason: r.reason,
    urgency: r.urgency,
  }))).select();
  const trips = assert(data, error, "createTrips");
  console.log(`  ✓ ${trips.length} trips creados`);
  return trips as Array<{ id: string; tenant_id: string; status: string; service_type: string; destination: string }>;
}

async function createTripOptions(
  trips: Array<{ id: string; tenant_id: string; status: string; service_type: string; destination: string }>,
  tenants: Record<string, string>,
  idByEmail: Record<string, string>
) {
  console.log("→ Creando trip options…");
  const markupByTenant: Record<string, Record<string, number>> = {};
  for (const [name, id] of Object.entries(tenants)) {
    const { data, error } = await admin.from("tenants").select("markup_flights, markup_hotels, markup_cars, markup_stands").eq("id", id).single();
    if (error) throw new Error(`[markup ${name}] ${error.message}`);
    markupByTenant[id] = {
      flight: Number(data.markup_flights),
      hotel: Number(data.markup_hotels),
      car: Number(data.markup_cars),
      stand: Number(data.markup_stands),
      mixed: Number(data.markup_flights),
    };
  }

  const optionRows: Record<string, unknown>[] = [];
  // Incluimos awaiting_payment: sus opciones necesitan is_selected=true (flujo B/C).
  const eligible = trips.filter(
    (t) =>
      t.status === "options_sent" ||
      t.status === "awaiting_selection" ||
      t.status === "awaiting_payment"
  );

  for (const trip of eligible) {
    const mk = markupByTenant[trip.tenant_id][trip.service_type] ?? 0.08;
    const providers =
      trip.service_type === "flight"
        ? [
            { provider: "Aeroméxico", net: 4200, details: { flight: "AM 904", cabin: "Economy", bags: 1 } },
            { provider: "Viva Aerobus", net: 3100, details: { flight: "VB 1234", cabin: "Economy Light", bags: 0 } },
            { provider: "Volaris", net: 3500, details: { flight: "Y4 567", cabin: "Economy Plus", bags: 1 } },
          ]
        : [
            { provider: "Marriott", net: 2600, details: { nights: 3, room: "Queen Executive" } },
            { provider: "Fiesta Inn", net: 1900, details: { nights: 3, room: "Queen Standard" } },
            { provider: "NH Collection", net: 2300, details: { nights: 3, room: "Superior" } },
          ];

    for (const p of providers) {
      optionRows.push({
        trip_id: trip.id,
        provider: p.provider,
        net_price: p.net,
        final_price: round2(p.net * (1 + mk)),
        currency: "MXN",
        details: p.details,
        is_selected: false,
        expires_at: isoOffset(7),
      });
    }
  }

  // El más barato del trip en awaiting_payment va seleccionado (para el flujo B/C).
  const awaitingTrips = trips.filter((t) => t.status === "awaiting_payment");
  const cheapestByTrip: Record<string, Record<string, unknown> | undefined> = {};
  for (const trip of awaitingTrips) {
    const tripOptions = optionRows.filter((o) => o.trip_id === trip.id);
    cheapestByTrip[trip.id] = tripOptions.sort(
      (a, b) => Number(a.final_price) - Number(b.final_price)
    )[0];
  }

  const { data, error } = await admin.from("trip_options").insert(optionRows).select();
  const options = assert(data, error, "createTripOptions");

  for (const trip of awaitingTrips) {
    const cheapest = cheapestByTrip[trip.id];
    if (!cheapest) continue;
    const match = options.find(
      (o) => o.trip_id === trip.id && o.provider === cheapest.provider
    );
    if (!match) continue;
    const { error: selErr } = await admin
      .from("trip_options")
      .update({ is_selected: true })
      .eq("id", (match as { id: string }).id);
    if (selErr) throw new Error(`[select option ${trip.id}] ${selErr.message}`);
  }

  console.log(
    `  ✓ ${options.length} options creadas (3 por trip en ${eligible.length} trips)` +
      (awaitingTrips.length
        ? `; opción seleccionada en ${awaitingTrips.length} trip(s) awaiting_payment`
        : "")
  );

  // Charge pendiente por la opción seleccionada (lo que FINANCE re-evaluará).
  if (awaitingTrips.length > 0) {
    const chargeRows = awaitingTrips.map((trip) => {
      const cheapest = cheapestByTrip[trip.id]!;
      return {
        tenant_id: trip.tenant_id,
        amount: Number(cheapest.final_price),
        type: "charge",
        reference: `TRIP-${trip.id.slice(0, 8)}`,
        status: "pending",
        created_by: idByEmail["finanzas@tora.mx"],
      };
    });
    const { error: chargeErr } = await admin.from("wallet_transactions").insert(chargeRows);
    if (chargeErr) throw new Error(`[pending charges] ${chargeErr.message}`);
    console.log(`  ✓ ${chargeRows.length} charge(s) pending por trip awaiting_payment`);
  }
}

// ── 5. Wallet + invoices ──────────────────────────────────────
async function createWalletAndInvoices(
  tenants: Record<string, string>,
  idByEmail: Record<string, string>
) {
  console.log("→ Creando wallet transactions…");
  const acero = tenants["Acero del Norte SA de CV"];
  const vcm = tenants["Viajes Corporativos MX SA de CV"];
  const aceroAdmin = idByEmail["admin@aceronorte.mx"];
  const toraFinance = idByEmail["finanzas@tora.mx"];

  const txRows = [
    { tenant_id: acero, amount: 150000, type: "deposit", reference: "SPEI 00518001234567", status: "completed", created_by: aceroAdmin, validated_by: toraFinance, validated_at: isoOffset(-12), receipt_url: `${acero}/spei-comprobante-001.pdf` },
    { tenant_id: acero, amount: 80000, type: "deposit", reference: "SPEI 00518009876543", status: "pending", created_by: aceroAdmin, receipt_url: `${acero}/spei-comprobante-002.pdf` },
    { tenant_id: vcm, amount: 80000, type: "deposit", reference: "SPEI 00518001112233", status: "completed", created_by: idByEmail["admin@vcm.mx"], validated_by: toraFinance, validated_at: isoOffset(-9) },
    { tenant_id: acero, amount: 12450.5, type: "charge", reference: "Cargo trip CDMX auditoría", status: "completed", created_by: toraFinance },
    { tenant_id: vcm, amount: 9780, type: "charge", reference: "Cargo hotel Mérida", status: "pending_payment", created_by: toraFinance },
  ];

  const { error } = await admin.from("wallet_transactions").insert(txRows);
  if (error) throw new Error(`[createWallet] ${error.message}`);
  console.log(`  ✓ ${txRows.length} wallet transactions (3 depósitos + 2 cargos; el charge pending del trip awaiting_payment se creó en la sección de options)`);

  console.log("→ Creando invoices…");
  const invoiceRows = [
    { tenant_id: acero, period: "2026-07", subtotal: 98250, iva: 15720, total: 113970, status: "issued", cfdi_uuid: "A1B2C3D4-E5F6-4789-ABCD-0123456789AB" },
    { tenant_id: acero, period: "2026-08", subtotal: 143600, iva: 22976, total: 166576, status: "paid", cfdi_uuid: "B2C3D4E5-F6A7-489A-BCDE-123456789ABC" },
    { tenant_id: vcm, period: "2026-08", subtotal: 54800, iva: 8768, total: 63568, status: "draft" },
  ];
  const { error: invErr } = await admin.from("invoices").insert(invoiceRows);
  if (invErr) throw new Error(`[createInvoices] ${invErr.message}`);
  console.log(`  ✓ ${invoiceRows.length} invoices`);

  console.log("→ Creando pipeline leads…");
  const leadRows = [
    { company_name: "Grupo Industrial Saltillo", contact_name: "Roberto Díaz", contact_email: "rdiaz@gisaltillo.mx", stage: "lead", estimated_monthly_spend: 80000, last_contact_at: isoOffset(-3) },
    { company_name: "Tecnológica del Bajío SA", contact_name: "Ana Sofía Ramírez", contact_email: "asofia@tec-bajio.mx", stage: "demo", estimated_monthly_spend: 45000, last_contact_at: isoOffset(-5) },
    { company_name: "Constructora Maya", contact_name: "Luis Pérez", stage: "pilot", estimated_monthly_spend: 120000, last_contact_at: isoOffset(-2) },
    { company_name: "Alimentos del Pacífico", contact_name: "María Fernanda López", stage: "pilot", estimated_monthly_spend: 60000, last_contact_at: isoOffset(-7) },
    { company_name: "Consultores Asociados MX", contact_name: "Jorge Mendoza", stage: "client", estimated_monthly_spend: 25000, last_contact_at: isoOffset(-1) },
  ];
  const { error: leadErr } = await admin.from("pipeline_leads").insert(leadRows);
  if (leadErr) throw new Error(`[createLeads] ${leadErr.message}`);
  console.log(`  ✓ ${leadRows.length} pipeline leads`);
}

// ── 6. Verificación + credenciales ────────────────────────────
async function verifyAndPrint() {
  const [{ count: nTenants }, { count: nUsers }, { data: statusCounts }] = await Promise.all([
    admin.from("tenants").select("id", { count: "exact", head: true }),
    admin.from("users").select("id", { count: "exact", head: true }),
    admin.from("trips").select("status"),
  ]);

  const byStatus = (statusCounts ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[(r as { status: string }).status] = (acc[(r as { status: string }).status] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n── Verificación ──");
  console.log(`  tenants: ${nTenants}  |  users: ${nUsers}`);
  console.log(`  trips por status: ${JSON.stringify(byStatus)}`);

  const emailW = Math.max(...USERS.map((u) => u.email.length));
  const roleW = Math.max(...USERS.map((u) => u.role.length));
  const tenantW = Math.max(...USERS.map((u) => (u.tenant ?? "—").length));
  console.log("\n── Credenciales de acceso (password: Tora2025!) ──");
  console.log(`${"EMAIL".padEnd(emailW)}  ${"ROLE".padEnd(roleW)}  ${"TENANT".padEnd(tenantW)}`);
  console.log("─".repeat(emailW + roleW + tenantW + 4));
  for (const u of USERS) {
    console.log(
      `${u.email.padEnd(emailW)}  ${u.role.padEnd(roleW)}  ${(u.tenant ?? "—").padEnd(tenantW)}`
    );
  }
  console.log(`\n✓ Seed completado.\n`);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log("\n== TORA SEED ==");
  await cleanup();
  const tenants = await createTenants();
  const { idByEmail } = await createUsers(tenants);
  const trips = await createTrips(tenants, idByEmail);
  await createTripOptions(trips, tenants, idByEmail);
  await createWalletAndInvoices(tenants, idByEmail);
  await verifyAndPrint();
}

main().catch((err) => {
  console.error("\n✗ Seed falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
