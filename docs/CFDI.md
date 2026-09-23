# Facturación CFDI (flujo manual)

TORA **no timbra**: el contador externo sube el JSON al PAC y devuelve el CFDI
timbrado. Este documento describe el flujo mensual completo.

## Flujo mensual

### Día 1 — Revisión

- En `/admin/invoices`, verificar que todos los viajes del mes anterior estén
  `completed` y con el cargo cobrado (wallet) o liquidado (crédito).
- Confirmar que los tenants tengan RFC / razón social / régimen fiscal
  capturados (Admin → Tenants). Sin RFC el export no se genera.

### Día 5 — Export y timbrado

1. `/admin/invoices` → **Descargar JSON para timbrado**.
2. Seleccionar cliente + período (default: mes actual) → **Generar y descargar**.
3. Enviar el `factura-{cliente}-{periodo}.json` al contador externo.
4. El contador lo sube al PAC (Facturapi, SW Sapien, etc.) y devuelve
   **PDF + XML + UUID**.

El JSON ya trae: emisor (TORA, régimen 601), receptor (datos fiscales del
tenant, uso CFDI G03), una partida `90121500 / E48` con la suma de los viajes
del período e IVA 16% desglosado, y la lista de viajes en `metadata`.

### Día 10 — Registro

- En `/admin/invoices` → **Subir factura** (dialog existente): PDF + XML + UUID.
- El cliente ve la factura en `/invoices` de su portal.

## Cancelaciones

1. Solicitar la cancelación al contador (el PAC la tramita ante el SAT).
2. Con el acuse, actualizar el estado de la factura a `cancelled` en
   `/admin/invoices`.

## Notas de crédito

Fuera de scope del MVP. Fase 2.

## Configuración Facturapi (Fase 2)

- Obtener API key en `dashboard.facturapi.io`.
- Integrar `lib/facturapi/client.ts` (no existe aún).
- Modo test → live cuando el flujo esté verificado con un CFDI real.
- Ese día, el botón "Descargar JSON" se puede mantener como respaldo de
  auditoría.

## Datos del contador

- Nombre: (placeholder — pendiente)
- Email: (placeholder — pendiente)
- Teléfono: (placeholder — pendiente)

## Datos fiscales de TORA (pendientes de reemplazar)

| Campo | Valor actual | Estado |
|---|---|---|
| RFC | `TDR240101AAA` | Placeholder |
| Razón social | `TORA SA de CV` | Placeholder |
| Domicilio fiscal | Ciudad de México, México | Placeholder |
| Régimen fiscal | 601 — General de Ley Personas Morales | Definitivo |
| Uso CFDI receptor | G03 — Gastos en general | Definitivo |
| Clave prod/serv | 90121500 — Agencias de viajes | Definitivo |
| Clave unidad | E48 — Unidad de servicio | Definitivo |

Viven en `lib/business/invoice-export.ts` (constante `EMISOR`).
