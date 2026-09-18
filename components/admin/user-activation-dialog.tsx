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
import { activateUserAction } from "@/app/(admin)/admin/users/actions";

const ROLES = [
  { value: "CLIENT_ADMIN", label: "CLIENT_ADMIN", needsTenant: true },
  { value: "CLIENT_FINANCE", label: "CLIENT_FINANCE", needsTenant: true },
  { value: "TORA_OPS", label: "TORA_OPS", needsTenant: false },
  { value: "TORA_FINANCE", label: "TORA_FINANCE", needsTenant: false },
  { value: "TORA_ADMIN", label: "TORA_ADMIN", needsTenant: false },
] as const;

export function UserActivationDialog({
  user,
  tenants,
  open: openProp,
  onOpenChange,
  trigger,
}: {
  user: { id: string; email: string; full_name: string | null };
  tenants: { id: string; name: string }[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const [role, setRole] = useState("CLIENT_ADMIN");
  const [tenantId, setTenantId] = useState("");
  const [saving, setSaving] = useState(false);

  const controlled = openProp !== undefined && onOpenChange !== undefined;
  const open = controlled ? openProp! : openState;
  const setOpen = (v: boolean) => {
    if (controlled) onOpenChange!(v);
    else setOpenState(v);
  };

  const selectedRole = ROLES.find((r) => r.value === role);
  const needsTenant = selectedRole?.needsTenant ?? true;

  async function handleActivate() {
    if (needsTenant && !tenantId) {
      toast.error("Selecciona un tenant", {
        description: "Los roles CLIENT requieren un tenant.",
      });
      return;
    }

    setSaving(true);
    const result = await activateUserAction(
      user.id,
      needsTenant ? tenantId : null,
      role
    );
    setSaving(false);

    if (!result.ok) {
      toast.error("No se pudo activar", { description: result.error });
      return;
    }
    toast.success("Usuario activado.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-h4 text-foreground">
            Activar usuario
          </DialogTitle>
          <DialogDescription className="text-body-s text-foreground/75">
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
            <Label>
              Tenant {needsTenant ? "(requerido)" : "(opcional — roles TORA no lo usan)"}
            </Label>
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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="font-display font-semibold"
          >
            Cancelar
          </Button>
          <Button onClick={handleActivate} disabled={saving}>
            {saving ? "Activando…" : "Activar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
