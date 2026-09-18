import { cn } from "@/lib/utils";

/**
 * Ilustraciones lineales TORA — SVG inline monocromos, stroke 2px,
 * geometría suiza. Heredan color con currentColor. Cero fotografía,
 * cero decoración: presencia silenciosa en empty states.
 */

type IllustrationProps = { className?: string };

function Svg({
  children,
  className,
  label,
}: IllustrationProps & { label: string; children: React.ReactNode }) {
  return (
    <svg
      width={160}
      height={160}
      viewBox="0 0 160 160"
      fill="none"
      role="img"
      aria-label={label}
      className={cn("h-40 w-40 text-muted-foreground/70/70", className)}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Avión estilizado con líneas de trayectoria. */
export function EmptyTrips({ className }: IllustrationProps) {
  return (
    <Svg className={className} label="Sin viajes">
      <path d="M52 104 88 44l14 14-38 52-16 4 4-10Z" />
      <path d="M88 44l16-8 12 12-8 16" />
      <path d="M62 96l14 14" />
      <path d="M28 128c14-4 24-4 36 0" opacity={0.55} />
      <path d="M84 132c16 4 30 2 44-6" opacity={0.55} />
    </Svg>
  );
}

/** Documento con líneas paralelas. */
export function EmptyInvoices({ className }: IllustrationProps) {
  return (
    <Svg className={className} label="Sin facturas">
      <path d="M50 28h44l20 20v84H50V28Z" />
      <path d="M94 28v20h20" />
      <path d="M62 68h36M62 82h36M62 96h24" />
      <circle cx="112" cy="112" r="14" opacity={0.55} />
      <path d="M122 122l10 10" opacity={0.55} />
    </Svg>
  );
}

/** Tarjeta y monedas. */
export function EmptyWallet({ className }: IllustrationProps) {
  return (
    <Svg className={className} label="Sin movimientos">
      <rect x="36" y="56" width="76" height="52" rx="6" />
      <path d="M36 72h76" />
      <path d="M48 92h20" />
      <circle cx="116" cy="96" r="14" opacity={0.55} />
      <path d="M116 89v14M112 92.5c0-2 1.8-3.5 4-3.5s4 1.2 4 3-1.8 3-4 3.5-4 1.6-4 3.5 1.8 3.5 4 3.5 4-1.5 4-3.5" opacity={0.55} strokeWidth={1.6} />
    </Svg>
  );
}

/** Lupa sobre cuadrícula vacía. */
export function EmptySearch({ className }: IllustrationProps) {
  return (
    <Svg className={className} label="Sin resultados">
      <path d="M56 32h20v20H56zM100 32h20v20h-20zM56 76h20v20H56z" opacity={0.5} />
      <circle cx="96" cy="96" r="24" />
      <path d="M113 113l18 18" />
    </Svg>
  );
}

/** Círculo roto — error. */
export function EmptyError({ className }: IllustrationProps) {
  return (
    <Svg className={className} label="Algo no salió bien">
      <path d="M80 24a56 56 0 1 1-39.6 16.4" />
      <path d="M52 26 44 40l14 6" opacity={0.55} />
      <path d="M66 66l28 28M94 66 66 94" />
    </Svg>
  );
}
