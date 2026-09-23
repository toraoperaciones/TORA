# WhatsApp — WAHA en Railway

## Estado actual (Sprint 3 cerrado)

- **WAHA corriendo en Railway:** `https://tora-waha-production.up.railway.app` (imagen `devlikeapro/waha`, engine WEBJS).
- **Sesión `tora-prod`: PENDIENTE.** No hay número dedicado conectado; el plan es un número de **EE.UU. (+1)**. Hasta escanear el QR, todos los envíos caen en *graceful degradation*: la app sigue funcionando y la notificación in-app (tabla `notifications`) es el respaldo.
- **Webhook:** `https://tora-eta.vercel.app/api/whatsapp/webhook` (configurado en Railway vía `WHATSAPP_HOOK_URL`; eventos `message.any,session.status`). Verifícalo: `curl https://tora-eta.vercel.app/api/whatsapp/webhook` → `{"ok":true,"service":"tora-whatsapp-webhook"}`.
- **Variables de entorno** (`.env.local` + Vercel producción, como Secret): `WAHA_API_URL`, `WAHA_API_KEY`, `WAHA_SESSION_NAME=tora-prod`.

## Conectar el número cuando llegue (2 minutos)

```bash
set -a; source .env.local; set +a

# 1. Crear e iniciar la sesión
curl -X POST "$WAHA_API_URL/api/sessions" \
  -H "X-Api-Key: $WAHA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"tora-prod","start":true}'

# 2. Obtener el QR (abrir la imagen y escanearla con el WhatsApp del chip:
#    Ajustes → Dispositivos vinculados → Vincular dispositivo)
curl "$WAHA_API_URL/api/tora-prod/auth/qr?format=image" \
  -H "X-Api-Key: $WAHA_API_KEY" --output /tmp/waha-qr.png
open /tmp/waha-qr.png

# 3. Verificar que quedó WORKING
curl "$WAHA_API_URL/api/sessions" -H "X-Api-Key: $WAHA_API_KEY"
# Esperado: [{"name":"tora-prod","status":"WORKING",...}]
```

Desde ese momento, los 4 hooks del producto (opciones enviadas, depósito
validado, crédito liquidado, reserva confirmada) envían WhatsApp real a los
usuarios con opt-in. Nada más que desplegar.

## Opt-in (obligatorio)

Solo reciben WhatsApp los usuarios con **las tres condiciones**:

- `users.whatsapp_enabled = true`
- `users.phone` capturado (formato E.164: `+1...` EE.UU. o `+52...` México)
- `users.status = 'active'`

El opt-in se captura en `/perfil` (card "Notificaciones por WhatsApp") y queda
registrado con timestamp en `users.whatsapp_opt_in_at` como evidencia LFPDPPP.
El opt-out **no** borra el timestamp (conserva la evidencia del consentimiento).
La activación pasa por la RPC `update_whatsapp_prefs` (migración 0022): la RLS
de `users` no permite UPDATE self a propósito — abrirla permitiría escalar
`role`/`status`.

## Rotar la API key de WAHA

1. Railway → servicio `tora-waha` → Variables → regenerar `WHATSAPP_API_KEY`.
2. Actualizar `.env.local` y Vercel:
   ```bash
   vercel env rm WAHA_API_KEY production --scope tora12 --yes
   vercel env add WAHA_API_KEY production --scope tora12
   vercel --prod --yes --scope tora12
   ```
3. Actualizar `.env.local` local con el mismo valor.

## Si WAHA se cae

La app **no se rompe**: `notifyUser()` intenta el envío, lo loggea y continúa;
la notificación in-app ya se insertó antes del intento de envío. Para
diagnosticar: logs del servicio en Railway y `curl $WAHA_API_URL/api/sessions`
(401 = key rota; timeout = servicio caído).
