# Runbook de incidentes

Diagnóstico rápido para los problemas más comunes. Los comandos SQL asumen sesión con permisos de lectura (Service Role o dashboard de Supabase).

## Tenant no puede entrar

Checklist:

- [ ] `users.status = 'active'` (no `pending_approval` ni `suspended`)
- [ ] El tenant tiene `status = 'active'`
- [ ] Email confirmado en Supabase Auth (Dashboard → Authentication → Users)
- [ ] Si tiene MFA: verificar que usa el código vigente
- [ ] Si sigue: reset de password vía Supabase Dashboard → "Send password recovery"

```sql
select u.email, u.status, u.role, t.name as tenant, t.status as tenant_status
from users u
left join tenants t on t.id = u.tenant_id
where u.email = '<email>';
```

## Viaje no aparece en la bandeja OPS

Checklist:

- [ ] `trips.status = 'pending_quote'` (los cotizados salen de la bandeja)
- [ ] El trip no está cancelado
- [ ] El `tenant_id` no pertenece a un tenant suspendido
- [ ] El usuario OPS tiene rol `TORA_OPS` o `TORA_ADMIN` activo

```sql
select id, status, tenant_id, created_at
from trips
where id = '<trip-id>';
```

## Depósito no se refleja en la billetera

Checklist:

- [ ] `wallet_transactions.status` sigue en `pending` → falta validación de FINANCE en `/finance/deposits`
- [ ] El comprobante está subido (`receipt_url is not null`)
- [ ] FINANCE no lo rechazó (buscar transacción con status `rejected` y `reference` del motivo)
- [ ] Si fue aprobado: el saldo vive en `tenants` (wallet) y el asiento es un `wallet_transactions` `completed`

```sql
select id, type, amount, status, reference, created_at
from wallet_transactions
where tenant_id = '<tenant-id>' and type = 'deposit'
order by created_at desc limit 5;
```

## WhatsApp no llega

Checklist:

- [ ] Sesión WAHA: `curl "$WAHA_API_URL/api/sessions"` → `tora-prod` debe estar `WORKING`; si no, re-escanear QR (`docs/WHATSAPP.md`)
- [ ] Usuario con `whatsapp_enabled = true` y teléfono E.164 válido
- [ ] La notificación in-app (`notifications`) existe → si existe pero no llegó el WhatsApp, es la sesión; si no existe, el hook no se disparó
- [ ] Webhook de WAHA apuntando a `/api/whatsapp/webhook`

## Suspensión por mora no se refleja

Checklist:

- [ ] El cron de mora corre (`pg_cron` → job diario; revisar `cron.job_run_details`)
- [ ] `trips.credit_due_date` vencido > 90 días → `suspend_tenant` en `/finance/credit`
- [ ] Después de suspender: el tenant ve bloqueo al crear nuevos viajes

## Rollback de deploy

Si un deploy rompió producción:

**Vercel CLI:**

```bash
vercel ls tora --scope tora12          # deployments recientes
vercel promote <deployment-url> --scope tora12
```

**Dashboard:** Deployments → último estable → "⋯" → **Promote to Production**.

Nota: si el problema es una migración de BD, el rollback del deploy no basta — revertir también la migración (todas son idempotentes pero no reversibles; escribir la migración inversa).

## Restaurar backup

Ver `docs/OPERATIONS.md` (sección Backup). **⚠️ Restaurar sobrescribe toda la base: solo en emergencia, con confirmación del fundador.**

## Contacto de escalamiento

Nivel 3 (fundador) para: caída de plataforma > 15 min, sospecha de fuga de datos, error de dinero que no se pueda reconciliar con `wallet_transactions`.
