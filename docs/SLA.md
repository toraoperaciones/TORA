# SLA — TORA

Compromisos de servicio para clientes del piloto. Revisar cada trimestre.

## Disponibilidad

- **Objetivo:** 99.5% mensual del portal (medido sobre `/api/health`).
- **Ventanas de mantenimiento:** se anuncian con ≥24 h por WhatsApp y email; fuera de horario hábil cuando sea posible.
- **Monitoreo:** UptimeRobot sondea `/api/health` y `/login` cada 5 minutos; alerta por email al equipo.

## Tiempos de respuesta (horario hábil)

| Operación | Compromiso |
|---|---|
| Cotización de viaje (pending_quote) | 4 horas hábiles |
| Incidente **critical** (vuelo cancelado) | 1 hora |
| Incidente **high** | 4 horas |
| Validación de depósito SPEI | 1 hora hábil |
| Ticket de soporte | 4 horas hábiles |
| Emisión de factura del mes | dentro de los primeros 10 días del mes |

## Canales de soporte

| Canal | Detalle | Horario |
|---|---|---|
| WhatsApp | Número de soporte TORA (configurado en `NEXT_PUBLIC_SUPPORT_WHATSAPP`) | L–V 9:00–19:00 CDMX |
| Email | soporte@tora.mx | L–V 9:00–19:00 CDMX |
| Portal | `/soporte` — formulario de tickets con prioridad | 24/7 (respuesta en horario hábil) |

## Escalamiento

1. **Nivel 1 — Soporte:** tickets y dudas de uso (`/soporte`).
2. **Nivel 2 — Operaciones:** incidentes de viajes (OPS) y movimientos de dinero (FINANCE).
3. **Nivel 3 — Fundador:** decisiones comerciales, suspensión de tenants, incidentes críticos de plataforma.

## Exclusiones

- Fallas de proveedores de viaje (aerolíneas, hoteles, rentadoras) no son responsabilidad de TORA; TORA gestiona el incidente con el proveedor en nombre del cliente.
- Indisponibilidad de Supabase o Vercel declarada por el proveedor se trata según su propio SLA; el runbook está en `docs/INCIDENTS.md`.
