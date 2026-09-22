"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleUserStatusAction } from "@/app/(admin)/admin/users/actions";

export function UserStatusButtons({
  userId,
  status,
}: {
  userId: string;
  status: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const suspended = status === "suspended";

  async function toggle() {
    setSaving(true);
    const result = await toggleUserStatusAction(userId, suspended ? "active" : "suspended");
    setSaving(false);
    if (!result.ok) {
      toast.error("No se pudo cambiar el estado", { description: result.error });
      return;
    }
    toast.success(suspended ? "Usuario reactivado." : "Usuario suspendido.");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void toggle()}
      disabled={saving}
      className="font-semibold"
    >
      {saving ? "…" : suspended ? "Reactivar" : "Suspender"}
    </Button>
  );
}
