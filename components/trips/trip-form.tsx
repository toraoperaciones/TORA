"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const tripSchema = z
  .object({
    origin: z.string().min(2, "Origen requerido"),
    destination: z.string().min(2, "Destino requerido"),
    departure_date: z.string().min(1, "Fecha de salida requerida"),
    return_date: z.string().optional(),
    passengers: z.coerce.number().int().min(1, "Mínimo 1 pasajero"),
    service_type: z.enum(["flight", "hotel", "car", "stand", "mixed"]),
    reason: z.string().min(3, "Describe el motivo del viaje"),
    urgency: z.enum(["normal", "urgent"]),
  })
  .refine(
    (data) => !data.return_date || data.return_date >= data.departure_date,
    { message: "El regreso no puede ser antes de la salida", path: ["return_date"] }
  );

// z.coerce hace que input ≠ output: el form parsea (input) y produce (output).
type TripFormInput = z.input<typeof tripSchema>;
type TripFormOutput = z.output<typeof tripSchema>;

const SERVICE_OPTIONS = [
  { value: "flight", label: "Vuelo" },
  { value: "hotel", label: "Hotel" },
  { value: "car", label: "Auto" },
  { value: "stand", label: "Stand" },
  { value: "mixed", label: "Mixto" },
] as const;

export function TripForm({
  userId,
  tenantId,
}: {
  userId: string;
  tenantId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serviceType, setServiceType] = useState<string>("flight");
  const [urgency, setUrgency] = useState<string>("normal");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TripFormInput, unknown, TripFormOutput>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      origin: "",
      destination: "",
      departure_date: "",
      return_date: "",
      passengers: 1,
      service_type: "flight",
      reason: "",
      urgency: "normal",
    },
  });

  async function onSubmit(values: TripFormOutput) {
    setSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase.from("trips").insert({
      tenant_id: tenantId,
      requester_id: userId,
      status: "pending_quote",
      origin: values.origin,
      destination: values.destination,
      departure_date: values.departure_date,
      return_date: values.return_date || null,
      passengers: values.passengers,
      service_type: values.service_type,
      reason: values.reason,
      urgency: values.urgency,
    });

    if (error) {
      toast.error("No se pudo enviar la solicitud", {
        description: error.message,
      });
      setSubmitting(false);
      return;
    }

    toast.success("Solicitud enviada. Operaciones cotizará en breve.");
    router.push("/trips");
    router.refresh();
  }

  return (
    <Card className="border-border-subtle bg-navy-lift shadow-none">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="origin">Origen</Label>
            <Input id="origin" placeholder="Monterrey" {...register("origin")} />
            {errors.origin && (
              <p className="text-caption font-semibold text-text-primary">
                {errors.origin.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="destination">Destino</Label>
            <Input
              id="destination"
              placeholder="Ciudad de México"
              {...register("destination")}
            />
            {errors.destination && (
              <p className="text-caption font-semibold text-text-primary">
                {errors.destination.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="departure_date">Fecha de salida</Label>
            <Input id="departure_date" type="date" {...register("departure_date")} />
            {errors.departure_date && (
              <p className="text-caption font-semibold text-text-primary">
                {errors.departure_date.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="return_date">Fecha de regreso (opcional)</Label>
            <Input id="return_date" type="date" {...register("return_date")} />
            {errors.return_date && (
              <p className="text-caption font-semibold text-text-primary">
                {errors.return_date.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="passengers">Pasajeros</Label>
            <Input
              id="passengers"
              type="number"
              min={1}
              {...register("passengers")}
            />
            {errors.passengers && (
              <p className="text-caption font-semibold text-text-primary">
                {errors.passengers.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="service_type">Tipo de servicio</Label>
            <Select
              value={serviceType}
              onValueChange={(value) => {
                setServiceType(value);
                setValue("service_type", value as TripFormInput["service_type"]);
              }}
            >
              <SelectTrigger id="service_type">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="urgency">Urgencia</Label>
            <Select
              value={urgency}
              onValueChange={(value) => {
                setUrgency(value);
                setValue("urgency", value as TripFormInput["urgency"]);
              }}
            >
              <SelectTrigger id="urgency">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              rows={3}
              placeholder="Reunión con cliente, feria, capacitación…"
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-caption font-semibold text-text-primary">
                {errors.reason.message}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full font-display font-semibold sm:w-auto"
            >
              {submitting ? "Enviando…" : "Solicitar viaje"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
