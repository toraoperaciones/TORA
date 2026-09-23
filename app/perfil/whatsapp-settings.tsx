"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateWhatsAppPreferencesAction } from "./actions";

/** E.164: + y 10-15 dígitos (cubre +1 EE.UU. y +52 MX). */
const PHONE_RE = /^\+[1-9]\d{9,14}$/;

/**
 * Preferencias de WhatsApp (opt-in explícito). El usuario activa el canal,
 * captura su teléfono E.164 y guarda. El servidor revalida y persiste.
 */
export function WhatsAppSettings({
  initialPhone,
  initialEnabled,
}: {
  initialPhone: string;
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const clean = phone.replace(/[\s()-]/g, "");
    if (clean && !PHONE_RE.test(clean)) {
      toast.error("Teléfono inválido", {
        description: "Usa formato internacional, ej. +5215512345678",
      });
      return;
    }

    setSaving(true);
    const { ok, error } = await updateWhatsAppPreferencesAction(
      clean || null,
      enabled
    );
    setSaving(false);

    if (!ok) {
      toast.error("No se pudo guardar", { description: error });
      return;
    }
    toast.success("Preferencias actualizadas.");
    router.refresh();
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Notificaciones por WhatsApp
        </CardTitle>
        <CardDescription className="text-sm text-foreground/75">
          Recibe avisos cuando tu viaje tenga opciones disponibles, validemos tu
          depósito SPEI, confirmemos tu reserva o se acerque tu vencimiento de
          crédito.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsapp-phone">Teléfono (WhatsApp)</Label>
          <Input
            id="whatsapp-phone"
            type="tel"
            placeholder="+52 1 55 1234 5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className="max-w-xs"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
            aria-label="Activar notificaciones por WhatsApp"
          />
          Activar notificaciones por WhatsApp
        </label>

        <p className="text-xs text-foreground/60">
          Al activar WhatsApp aceptas recibir mensajes transaccionales de TORA.
          Puedes desactivarlos en cualquier momento.
        </p>

        <div>
          <Button onClick={handleSave} disabled={saving} className="font-semibold">
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
