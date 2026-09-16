import { PortalShell } from "@/components/layout/portal-shell";
import { guardPortal } from "@/lib/auth/portal-guard";

export default async function FinancePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, fullName, email } = await guardPortal("finance");

  return (
    <PortalShell role={role} fullName={fullName} email={email}>
      {children}
    </PortalShell>
  );
}
