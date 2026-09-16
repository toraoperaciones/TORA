import { PortalShell } from "@/components/layout/portal-shell";
import { guardPortal } from "@/lib/auth/portal-guard";

export default async function OpsPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, fullName, email } = await guardPortal("ops");

  return (
    <PortalShell role={role} fullName={fullName} email={email}>
      {children}
    </PortalShell>
  );
}
