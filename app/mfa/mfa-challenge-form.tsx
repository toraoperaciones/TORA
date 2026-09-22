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
import { verifyLoginChallenge } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/client";

/**
 * Challenge TOTP del login: la sesión de password ya existe (el middleware
 * nos trajo aquí); verificar promueve la sesión a AAL2 y entra al portal.
 */
export function MfaChallengeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    const result = await verifyLoginChallenge(supabase, code);
    if (!result.ok) {
      toast.error(result.error ?? "Código incorrecto. Intenta de nuevo.");
      setSubmitting(false);
      return;
    }
    router.push("/");
    // "/" redirige al portal por rol; refresh asienta la sesión AAL2.
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Verificación en dos pasos</CardTitle>
        <CardDescription>
          Ingresa el código de 6 dígitos de tu app autenticadora.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mfa-code">Código TOTP</Label>
            <Input
              id="mfa-code"
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="text-center text-2xl tracking-[0.5em] tabular-nums"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              required
            />
            {code && code.length !== 6 && (
              <p className="text-xs font-semibold text-foreground/75">
                El código tiene 6 dígitos.
              </p>
            )}
          </div>
          <Button type="submit" disabled={submitting || code.length !== 6} className="font-semibold">
            {submitting ? "Verificando…" : "Verificar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
