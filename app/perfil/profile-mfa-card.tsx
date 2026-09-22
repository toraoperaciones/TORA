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
import { enrollTotp } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/client";

interface ProfileMfaCardProps {
  email: string;
  flagEnabled: boolean;
  hasVerifiedFactor: boolean;
  enabledAt: string | null;
}

/**
 * Sección MFA del perfil. Estados:
 *  - Factor verificado + flag on → activado (fecha). Acción: desactivar.
 *  - Factor verificado + flag off → configured. Acción: reactivar (solo flag).
 *  - Sin factor → desactivado. Acción: flujo enroll (QR → código).
 */
export function ProfileMfaCard({
  flagEnabled,
  hasVerifiedFactor,
  enabledAt,
}: ProfileMfaCardProps) {
  const router = useRouter();

  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const active = flagEnabled && hasVerifiedFactor;

  async function startEnroll() {
    setBusy(true);
    try {
      const supabase = createClient();
      const factor = await enrollTotp(supabase);
      setFactorId(factor.id);
      setQr(factor.totp.qr_code ?? null);
      setSecret(factor.totp.secret ?? null);
      setEnrolling(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar el MFA");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw new Error("No se pudo iniciar la verificación");

      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge?.id ?? "",
        code,
      });
      if (error) throw new Error("Código incorrecto. Intenta de nuevo.");

      const { error: flagError } = await supabase.rpc("set_mfa_flag", {
        enabled: true,
      });
      if (flagError) throw new Error(flagError.message);

      toast.success("Autenticación de dos factores activada.");
      setEnrolling(false);
      setQr(null);
      setSecret(null);
      setCode("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al activar");
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_mfa_flag", { enabled: false });
      if (error) throw new Error(error.message);
      toast.success("Autenticación de dos factores desactivada.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al desactivar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Autenticación de dos factores
        </CardTitle>
        <CardDescription>
          Protege tu cuenta con un código de 6 dígitos (Google Authenticator,
          Authy, 1Password). Opcional: la activas solo tú, desde tu cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {active ? "Activado" : hasVerifiedFactor ? "Configurado (inactivo)" : "Desactivado"}
            </p>
            {active && enabledAt && (
              <p className="text-xs text-muted-foreground">
                Desde{" "}
                {new Date(enabledAt).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "America/Mexico_City",
                })}
              </p>
            )}
          </div>
          <Badge active={active} />
        </div>

        {active ? (
          <Button variant="outline" onClick={disableMfa} disabled={busy} className="font-semibold">
            Desactivar
          </Button>
        ) : enrolling && qr ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Código QR para tu app autenticadora" className="h-44 w-44 rounded bg-white p-2" />
              {secret && (
                <p className="break-all text-center text-xs text-muted-foreground">
                  Si no puedes escanear, ingresa en tu app este código:{" "}
                  <span className="font-mono font-semibold text-foreground">{secret}</span>
                </p>
              )}
            </div>
            <form onSubmit={confirmCode} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="enroll-code">Código de 6 dígitos</Label>
                <Input
                  id="enroll-code"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  className="text-center text-xl tracking-[0.4em] tabular-nums"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                />
              </div>
              <Button type="submit" disabled={busy || code.length !== 6} className="font-semibold">
                {busy ? "Verificando…" : "Activar"}
              </Button>
            </form>
          </div>
        ) : (
          <Button onClick={startEnroll} disabled={busy} className="font-semibold">
            {busy ? "Preparando…" : "Activar"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}
