"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

export function ReceiptViewer({
  path,
  open,
  onOpenChange,
}: {
  path: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !path) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSignedUrl(null);

    const supabase = createClient();
    supabase.storage
      .from("receipts")
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setError(error?.message ?? "No se pudo generar el enlace");
        else setSignedUrl(data.signedUrl);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, path]);

  const isPdf = path?.toLowerCase().endsWith(".pdf") ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Comprobante SPEI
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            Enlace firmado con validez de 1 hora.
          </DialogDescription>
        </DialogHeader>

        {loading && <Skeleton className="h-96 w-full" />}

        {!loading && error && (
          <p className="text-sm font-semibold text-foreground">{error}</p>
        )}

        {!loading && signedUrl && isPdf && (
          <iframe src={signedUrl} title="Comprobante" className="h-96 w-full rounded-md border border-border" />
        )}

        {!loading && signedUrl && !isPdf && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedUrl}
            alt="Comprobante SPEI"
            className="max-h-96 w-full rounded-md border border-border object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
