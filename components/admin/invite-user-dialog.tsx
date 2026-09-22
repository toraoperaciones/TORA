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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteUserAction } from "@/app/(admin)/admin/users/actions";

const ROLES = ["CLIENT_ADMIN", "CLIENT_FINANCE"] as const;

export function InviteUserDialog({
  tenant,
  trigger,
}: {
  tenant: { id: string; name: string };
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("CLIENT_ADMIN");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleInvite() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Email inválido");
      return;
    }
    if (password.length < 8) {
      toast.error("La contraseña temporal debe tener al menos 8 caracteres");
      return;
    }

    setSaving(true);
    const result = await inviteUserAction({
      email,
      fullName,
      tenantId: tenant.id,
      role,
      password,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error("No se pudo invitar", { description: result.error });
      return;
    }
    toast.success("Usuario invitado y activado.");
    setOpen(false);
    setEmail("");
    setFullName("");
    setPassword("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="font-semibold">Invitar usuario</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Invitar usuario · {tenant.name}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            Crea el usuario con acceso inmediato. Comparte la contraseña temporal por un
            canal seguro.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.mx"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-name">Nombre (opcional)</Label>
            <Input
              id="invite-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-password">Contraseña temporal</Label>
            <Input
              id="invite-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="font-semibold">
            Cancelar
          </Button>
          <Button onClick={handleInvite} disabled={saving} className="font-semibold">
            {saving ? "Creando…" : "Invitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
