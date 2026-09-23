"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  createIssuerAction,
  uploadCsdAction,
} from "@/app/(admin)/admin/issuers/actions";
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

const inputClass = "border-input bg-background text-sm";

export function NewIssuerDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    const result = await createIssuerAction({
      internal_name: String(formData.get("internal_name") ?? ""),
      rfc: String(formData.get("rfc") ?? ""),
      razon_social: String(formData.get("razon_social") ?? ""),
      regimen_fiscal: String(formData.get("regimen_fiscal") ?? "601"),
      codigo_postal: String(formData.get("codigo_postal") ?? ""),
      sat_monthly_limit: Number(formData.get("sat_monthly_limit") ?? 2000),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error("No se pudo crear la emisora", { description: result.error });
      return;
    }
    toast.success("Empresa emisora creada.");
    setOpen(false);
    formRef.current?.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-semibold">Nueva empresa</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Nueva empresa emisora
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            Razón social con la que TORA timbra. Se crea su organización en
            Facturapi (modo test) automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="issuer-internal">Nombre interno</Label>
            <Input
              id="issuer-internal"
              name="internal_name"
              required
              placeholder="Emisora A"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="issuer-razon">Razón social</Label>
            <Input
              id="issuer-razon"
              name="razon_social"
              required
              placeholder="Torizonte Logística SA de CV"
              className={inputClass}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="issuer-rfc">RFC</Label>
              <Input
                id="issuer-rfc"
                name="rfc"
                required
                placeholder="TLO240101AB1"
                className={`${inputClass} font-mono uppercase`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="issuer-cp">Código postal</Label>
              <Input
                id="issuer-cp"
                name="codigo_postal"
                required
                inputMode="numeric"
                pattern="\d{5}"
                title="5 dígitos"
                placeholder="06600"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="issuer-regimen">Régimen fiscal</Label>
              <Input
                id="issuer-regimen"
                name="regimen_fiscal"
                required
                defaultValue="601"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="issuer-limit">Límite mensual SAT</Label>
              <Input
                id="issuer-limit"
                name="sat_monthly_limit"
                type="number"
                defaultValue={2000}
                min={1}
                className={inputClass}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="font-semibold"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="font-semibold">
              {saving ? "Creando…" : "Crear emisora"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export function UploadCsdDialog({
  issuerId,
  issuerName,
  hasOrg,
}: {
  issuerId: string;
  issuerName: string;
  hasOrg: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cerName, setCerName] = useState("");
  const [keyName, setKeyName] = useState("");

  async function handleSubmit(formData: FormData) {
    const cer = formData.get("csd-cer") as File | null;
    const key = formData.get("csd-key") as File | null;
    const password = String(formData.get("csd-password") ?? "");
    if (!cer?.size || !key?.size || !password) {
      toast.error("Archivos .cer, .key y contraseña son obligatorios");
      return;
    }
    setSaving(true);
    const result = await uploadCsdAction({
      issuerId,
      cer_b64: await fileToBase64(cer),
      key_b64: await fileToBase64(key),
      password,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error("No se pudo subir el CSD", { description: result.error });
      return;
    }
    toast.success(`CSD de ${issuerName} guardado y cifrado.`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-semibold">
          {hasOrg ? "Subir CSD" : "Configurar"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            CSD de {issuerName}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            Certificado de Sello Digital (.cer y .key) del SAT. Se valida en
            Facturapi y se guarda cifrado en la base de datos.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="csd-cer">Archivo .cer</Label>
            <Input
              id="csd-cer"
              name="csd-cer"
              type="file"
              accept=".cer"
              required
              className={inputClass}
              onChange={(e) => setCerName(e.target.files?.[0]?.name ?? "")}
            />
            {cerName ? (
              <p className="text-xs text-foreground/60">{cerName}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="csd-key">Archivo .key</Label>
            <Input
              id="csd-key"
              name="csd-key"
              type="file"
              accept=".key"
              required
              className={inputClass}
              onChange={(e) => setKeyName(e.target.files?.[0]?.name ?? "")}
            />
            {keyName ? (
              <p className="text-xs text-foreground/60">{keyName}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="csd-password">Contraseña del CSD</Label>
            <Input
              id="csd-password"
              name="csd-password"
              type="password"
              required
              autoComplete="off"
              className={inputClass}
            />
            <p className="text-xs text-foreground/60">
              Se cifra con AES-256-GCM antes de guardarse. Nunca se muestra de
              nuevo.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="font-semibold"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="font-semibold">
              {saving ? "Subiendo…" : "Subir CSD"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
