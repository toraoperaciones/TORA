"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserAction, toggleUserStatusAction } from "@/app/(admin)/admin/users/actions";

const ROLES = [
  { value: "CLIENT_ADMIN", label: "CLIENT_ADMIN", needsTenant: true },
  { value: "CLIENT_FINANCE", label: "CLIENT_FINANCE", needsTenant: true },
  { value: "TORA_OPS", label: "TORA_OPS", needsTenant: false },
  { value: "TORA_FINANCE", label: "TORA_FINANCE", needsTenant: false },
  { value: "TORA_ADMIN", label: "TORA_ADMIN", needsTenant: false },
] as const;

interface UserEditDialogProps {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    tenant_id: string | null;
    status: string;
  };
  tenants: { id: string; name: string }[];
  trigger?: React.ReactNode;
}

export function UserEditDialog({ user, tenants, trigger }: UserEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user.role);
  const [tenantId, setTenantId] = useState(user.tenant_id ?? "");
  const [status, setStatus] = useState(user.status);
  const [saving, setSaving] = useState(false);

  const selectedRole = ROLES.find((r) => r.value === role);
  const needsTenant = selectedRole?.needsTenant ?? true;

  async function handleSave() {
    if (needsTenant && !tenantId) {
      toast.error("Selecciona un tenant", {
        description: "Los roles CLIENT requieren un tenant.",
      });
      return;
    }
    if (user.email === process.env.NEXT_PUBLIC_TORA_ADMIN_LOCK) {
      // Guard opcional; nunca bloqueado por defecto.
    }

    setSaving(true);

    // Cambios de rol/tenant vía RPC (actualiza solo si difieren).
    let lastError: string | undefined;
    if (role !== user.role || (needsTenant ? tenantId : null) !== user.tenant_id) {
      const res = await updateUserAction(user.id, needsTenant ? tenantId : null, role);
      if (!res.ok) lastError = res.error;
    }

    // Cambio de estado vía RPC toggle.
    if (!lastError && status !== user.status) {
      const res = await toggleUserStatusAction(
        user.id,
        status === "suspended" ? "suspended" : "active"
      );
      if (!res.ok) lastError = res.error;
    }

    setSaving(false);
    if (lastError) {
      toast.error("No se pudo guardar", { description: lastError });
      return;
    }
    toast.success("Usuario actualizado.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant="outline" size="sm" className="font-semibold">Editar</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">Editar usuario</DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            {user.full_name ?? "—"} · {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tenant {needsTenant ? "(requerido)" : "(opcional)"}</Label>
            <Select
              value={tenantId || undefined}
              onValueChange={setTenantId}
              disabled={!needsTenant}
            >
              <SelectTrigger>
                <SelectValue placeholder={needsTenant ? "Selecciona tenant" : "—"} />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="suspended">Suspendido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="font-semibold">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="font-semibold">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
