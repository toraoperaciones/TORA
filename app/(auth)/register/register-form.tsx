"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";

const registerSchema = z.object({
  fullName: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterForm) {
    setSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName, role: "CLIENT_ADMIN" },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      // Sin rojo: Navy + texto. El caso más común es email ya registrado.
      toast.error("No se pudo crear la cuenta", {
        description:
          error.status === 422
            ? "Este correo ya está registrado."
            : "Inténtalo de nuevo en unos momentos.",
      });
      setSubmitting(false);
      return;
    }

    toast.success("Cuenta creada. Pendiente de aprobación.");
    router.push("/pending");
  }

  return (
    <Card className="border-border-subtle bg-navy-lift shadow-none">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex justify-center">
          <Logo size="lg" />
        </div>
        <CardTitle className="font-display text-h2 text-text-primary">
          Crea tu cuenta
        </CardTitle>
        <CardDescription className="text-body-s text-text-secondary">
          Registra tu empresa en TORA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Ana García"
              {...register("fullName")}
            />
            {errors.fullName && (
              <p className="text-caption font-semibold text-text-primary">
                {errors.fullName.message}
              </p>
            )}
          </div>

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
              <p className="text-caption font-semibold text-text-primary">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-caption font-semibold text-text-primary">
                {errors.password.message}
              </p>
            )}
          </div>

          <p className="prose-tora text-caption text-text-secondary">
            Tu cuenta será revisada por el equipo de TORA antes de activarse.
          </p>

          <Button
            type="submit"
            disabled={submitting}
            className="font-display font-semibold"
          >
            {submitting ? "Creando cuenta…" : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-6 text-center text-body-s text-text-secondary">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-semibold text-text-primary underline underline-offset-4 hover:text-text-secondary"
          >
            Inicia sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
