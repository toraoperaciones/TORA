"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Logo } from "@/components/brand/logo";
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
import { homeForRole, type Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginForm) {
    setSubmitting(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      // Sin rojo: Navy + AlertCircle vía sonner.
      toast.error("Credenciales inválidas", {
        description: "Revisa tu correo y contraseña.",
      });
      setSubmitting(false);
      return;
    }

    const role = (data.user?.user_metadata?.role ?? "CLIENT_ADMIN") as Role;

    // next solo si es ruta interna (evita open redirects).
    const rawNext = searchParams.get("next");
    const next = rawNext && rawNext.startsWith("/") ? rawNext : null;

    // Sin refresh(): llamarlo junto a push() aborta la navegación (race del
    // router en Next 15) y el usuario queda atascado en "Ingresando…".
    // El push ya carga la ruta destino con la cookie de sesión nueva.
    router.push(next ?? homeForRole(role));
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex justify-center">
          <Logo variant="lockup" theme="light" size="lg" />
        </div>
        <CardTitle className="font-display text-h2 text-foreground">
          Inicia sesión
        </CardTitle>
        <CardDescription className="text-body-s text-muted-foreground">
          Accede a tu cuenta corporativa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@empresa.mx"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-caption font-semibold text-foreground">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-caption font-semibold text-foreground">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Ingresando…" : "Ingresar"}
          </Button>

          {/* TODO(phase-2): habilitar Google con signInWithOAuth → /auth/callback */}
          <Button
            type="button"
            variant="outline"
            disabled
            title="Próximamente"
          >
            Continuar con Google
          </Button>
        </form>

        <p className="mt-6 text-center text-body-s text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link
            href="/register"
            className="font-semibold text-foreground underline underline-offset-4 hover:text-foreground/75"
          >
            Regístrate
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
