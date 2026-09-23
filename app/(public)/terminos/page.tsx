import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { LegalTemplateBanner, LegalUpdatedAt } from "@/components/legal/legal-bits";

export const metadata: Metadata = pageMetadata("Términos y Condiciones");

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "1. Aceptación de los términos",
    body: [
      "Al registrarte en TORA y utilizar la plataforma aceptas estos Términos y Condiciones. Si no estás de acuerdo, no utilices el servicio.",
    ],
  },
  {
    title: "2. Descripción del servicio",
    body: [
      "TORA es una plataforma de gestión de viajes corporativos: cotizamos, reservamos y administras viajes de negocio con proveedores terceros.",
      "Modelo comercial: márgenes embebidos en el precio de cada servicio, sin cuotas de suscripción.",
      "Medios de pago: billetera con depósitos SPEI y línea de crédito a 30 días sujeta a aprobación.",
    ],
  },
  {
    title: "3. Cuenta del cliente",
    body: [
      "El servicio está dirigido a empresas mexicanas con RFC vigente.",
      "Las cuentas se activan después de un proceso de revisión por parte de TORA.",
      "Eres responsable de la confidencialidad de tus credenciales y de la actividad realizada con tu cuenta. Recomendamos activar la verificación en dos pasos en Mi perfil.",
    ],
  },
  {
    title: "4. Obligaciones del cliente",
    body: [
      "Pagar en tiempo los cargos de tu billetera y de tu línea de crédito.",
      "Proporcionar información veraz y mantener tus datos fiscales actualizados.",
      "Usar la plataforma conforme a su propósito: viajes de negocio.",
    ],
  },
  {
    title: "5. Obligaciones de TORA",
    body: [
      "Prestar el servicio con diligencia profesional y mantener la confidencialidad de tu información.",
      "Emitir la factura interna correspondiente y gestionar el timbrado fiscal de las facturas mediante nuestro proveedor externo.",
    ],
  },
  {
    title: "6. Limitación de responsabilidad",
    body: [
      "TORA no es aerolínea, hotel, rentadora de autos ni prestador directo de servicios de viaje.",
      "No respondemos por cancelaciones, retrasos o incumplimientos de los proveedores; en esos casos gestionamos el reclamo ante el proveedor en tu nombre.",
      "La responsabilidad máxima de TORA se limita al monto del viaje afectado.",
    ],
  },
  {
    title: "7. Precios y pagos",
    body: [
      "Los precios finales incluyen el margen de TORA por tipo de servicio, que se muestra desglosado al momento de la cotización cuando corresponde.",
      "Interés moratorio: 2.5% mensual sobre saldos vencidos de crédito, aplicable a partir del día 31 de vencido.",
      "Las cuentas con saldos vencidos mayores a 90 días pueden ser suspendidas.",
    ],
  },
  {
    title: "8. Terminación",
    body: [
      "Cualquiera de las partes puede dar por terminada la relación comercial notificando por escrito.",
      "La terminación no extingue los saldos pendientes de pago ni las obligaciones fiscales ya devengadas.",
    ],
  },
  {
    title: "9. Ley aplicable y jurisdicción",
    body: [
      "Estos términos se rigen por las leyes de los Estados Unidos Mexicanos.",
      "Para cualquier controversia, las partes se someten a los tribunales competentes de la Ciudad de México, renunciando a cualquier otro fuero.",
    ],
  },
];

export default function TerminosPage() {
  return (
    <article className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold text-foreground">Términos y Condiciones</h1>
      <LegalTemplateBanner />
      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
          <div className="flex flex-col gap-2">
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-foreground/80">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}
      <LegalUpdatedAt />
    </article>
  );
}
