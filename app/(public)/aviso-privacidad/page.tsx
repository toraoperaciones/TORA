import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { LegalTemplateBanner, LegalUpdatedAt } from "@/components/legal/legal-bits";

export const metadata: Metadata = pageMetadata("Aviso de Privacidad");

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "1. Identidad del responsable",
    body: [
      "TORA SA de CV, con domicilio fiscal en Ciudad de México, México, es el responsable del tratamiento de tus datos personales.",
      "RFC: TDR240101AAA (placeholder provisional).",
      "Contacto para temas de privacidad: legal@tora.mx.",
    ],
  },
  {
    title: "2. Datos personales que recabamos",
    body: [
      "Datos de identificación: nombre completo, correo electrónico y teléfono.",
      "Datos fiscales: RFC y datos de facturación de tu empresa.",
      "Datos de viaje: destinos, fechas, número de pasajeros y tipo de servicio (vuelos, hoteles, autos, stands).",
      "Datos de pago: no almacenamos información bancaria sensible. Los pagos se realizan por SPEI y solo conservamos la referencia de la transferencia.",
    ],
  },
  {
    title: "3. Finalidades del tratamiento",
    body: [
      "Primarias: prestar el servicio de gestión de viajes corporativos, cotizar y reservar con proveedores, facturar, validad pagos y darte soporte.",
      "Secundarias: enviarte comunicaciones comerciales. Requieren tu consentimiento expreso y separado; puedes revocarlo en cualquier momento.",
      "Las notificaciones por WhatsApp son transaccionales y opcionales: se activan solo con tu consentimiento en la sección Mi perfil.",
    ],
  },
  {
    title: "4. Transferencias de datos",
    body: [
      "Compartimos los datos estrictamente necesarios con: proveedores de viaje (aerolíneas, hoteles, rentadoras de autos y organizadores de stands) para ejecutar tus reservas.",
      "Con el SAT y nuestro proveedor de certificación (PAC) para la emisión de facturas fiscales.",
      "No vendemos ni cedemos tus datos a terceros con fines distintos a los descritos.",
    ],
  },
  {
    title: "5. Derechos ARCO",
    body: [
      "Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos enviando un correo a legal@tora.mx con tu identificación oficial.",
      "El plazo máximo de respuesta es de 20 días hábiles.",
    ],
  },
  {
    title: "6. Uso de cookies",
    body: [
      "Usamos únicamente cookies esenciales de sesión para mantener tu identidad en la plataforma.",
      "No utilizamos cookies de rastreo de terceros.",
    ],
  },
  {
    title: "7. Cambios a este aviso",
    body: [
      "Publicaremos cualquier cambio en esta página. Los cambios materiales serán notificados por correo electrónico a los usuarios registrados.",
    ],
  },
];

export default function AvisoPrivacidadPage() {
  return (
    <article className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold text-foreground">Aviso de Privacidad</h1>
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
