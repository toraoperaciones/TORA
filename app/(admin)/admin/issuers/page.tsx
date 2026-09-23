import { NewIssuerDialog, UploadCsdDialog } from "@/components/admin/issuer-dialogs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listIssuers, type IssuerSummary } from "@/lib/business/facturapi-orgs";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("Empresas emisoras");

function CsdBadge({ issuer }: { issuer: IssuerSummary }) {
  if (issuer.csd_uploaded_at) {
    return (
      <Badge className="border-transparent bg-primary font-medium text-primary-foreground">
        CSD listo
      </Badge>
    );
  }
  if (issuer.facturapi_organization_id) {
    return (
      <Badge className="border-border bg-transparent font-medium text-foreground/75">
        Org creada — falta CSD
      </Badge>
    );
  }
  return (
    <Badge className="border-border bg-transparent font-medium text-foreground/60">
      Sin organización
    </Badge>
  );
}

export default async function AdminIssuersPage() {
  // Estado guardado: la migración 0025 (issuer_companies) aún no está
  // aplicada — PostgREST responde PGRST205 (tabla fuera del schema cache).
  // La UI lo dice en lugar de reventar.
  let setupPending = false;
  let issuers: IssuerSummary[] = [];
  try {
    issuers = await listIssuers();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("42P01") || msg.includes("Could not find the table")) {
      setupPending = true;
    } else {
      throw err;
    }
  }

  const withCsd = issuers.filter((i) => i.csd_uploaded_at).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Empresas emisoras
          </h1>
          <p className="mt-1 text-sm text-foreground/75">
            Razones sociales con las que TORA timbra. Uso interno — el cliente
            nunca las ve.
          </p>
        </div>
        {!setupPending && <NewIssuerDialog />}
      </div>

      {setupPending ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Configuración pendiente
          </h2>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm text-foreground/75">
            La migración <code className="font-mono text-xs">0025_issuer_companies</code>{" "}
            no está aplicada todavía. Aplica migraciones y recarga esta página.
          </p>
        </div>
        ) : issuers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Aún no hay empresas emisoras
          </h2>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm text-foreground/75">
            Registra las razones sociales de TORA. Cada cliente nuevo se
            asigna automáticamente a la de menor carga y queda fijo.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-4">
            {[
              { label: "Emisoras", value: issuers.length },
              { label: "Con CSD listo", value: withCsd },
              { label: "Tenants asignados", value: issuers.reduce((a, i) => a + i.tenants_count, 0) },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="flex-1 rounded-lg border border-border bg-card px-5 py-4"
              >
                <p className="text-xs uppercase tracking-wider text-foreground/60">
                  {kpi.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Empresa</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">RFC</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Tenants</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">Entorno</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-foreground/75">CSD</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-foreground/75">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issuers.map((issuer) => (
                  <TableRow key={issuer.id} className="border-border">
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{issuer.internal_name}</p>
                      <p className="text-xs text-foreground/60">{issuer.razon_social}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground/75">{issuer.rfc}</TableCell>
                    <TableCell className="text-sm tabular-nums text-foreground">{issuer.tenants_count}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          issuer.facturapi_environment === "live"
                            ? "border-transparent bg-primary font-medium text-primary-foreground"
                            : "border-border bg-transparent font-medium text-foreground/75"
                        }
                      >
                        {issuer.facturapi_environment === "live" ? "Producción" : "Test"}
                      </Badge>
                    </TableCell>
                    <TableCell><CsdBadge issuer={issuer} /></TableCell>
                    <TableCell className="text-right">
                      <UploadCsdDialog issuerId={issuer.id} issuerName={issuer.internal_name} hasOrg={Boolean(issuer.facturapi_organization_id)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
