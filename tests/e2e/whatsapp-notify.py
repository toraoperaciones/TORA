"""Sprint 3 E2E — preferencias WhatsApp + notificación in-app end-to-end.

Ejercicio real contra dev server (puerto 3210) y BD de producción:
  1. /perfil renderiza la card de WhatsApp.
  2. Guardar teléfono sin activar → persiste, whatsapp_enabled=false.
  3. Activar sin teléfono → rechazado (validación cliente y servidor).
  4. Activar con teléfono → persiste + whatsapp_opt_in_at.
  5. Flujo real: OPS cotiza trip fixture → envía al cliente →
     notifications contiene trip_options_sent (hook server-side).
  6. WAHA real: skip si la sesión no está WORKING (chip pendiente de QR).

Contraseñas leídas de .secrets (nunca impresas). Fixtures por service-role,
limpieza verificada al final (residuo = 0).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3210"
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANON = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
SECRETS = os.path.expanduser(
    "~/.secrets/passwords-20260921.txt"
)
if not os.path.exists(SECRETS):
    SECRETS = os.path.join(os.getcwd(), ".secrets/passwords-20260921.txt")

# Cargar contraseñas en memoria: formato "email password" (separado por espacios).
PW = {}
with open(SECRETS, encoding="utf-8") as fh:
    for line in fh:
        parts = line.strip().split(None, 1)
        if len(parts) == 2:
            PW[parts[0]] = parts[1]


def save_pw(email, new_pw):
    """Persiste rotaciones de contraseña en .secrets (nunca las imprime)."""
    lines = []
    with open(SECRETS, encoding="utf-8") as fh:
        lines = fh.readlines()
    with open(SECRETS, "w", encoding="utf-8") as fh:
        for line in lines:
            if line.startswith(email + " "):
                fh.write(f"{email} {new_pw}\n")
            else:
                fh.write(line)

ACERO = "b6eb151f-a417-4911-9314-0af8bedf06ce"  # tenant prepaid del seed
STAMP = str(int(time.time()))[-7:]
SHOTS = "/tmp/sprint3-whatsapp"
os.makedirs(SHOTS, exist_ok=True)

PASS = []
FAIL = []


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
        print(f"  PASS  {name}")
    else:
        FAIL.append(f"{name} {detail}")
        print(f"  FAIL  {name}  {detail}")


REST = URL + "/rest/v1"


def api(path, body=None, method=None):
    """PostgREST: path relativo a /rest/v1 (ej. /users?select=id)."""
    if method is None:
        method = "POST" if body is not None else "GET"
    req = urllib.request.Request(
        REST + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print(f"    [api {method} {path}] HTTP {e.code}: {e.read().decode()[:200]}")
        return None
    except (urllib.error.URLError, OSError) as e:
        # Reset de red transitorio: reintentar en breve.
        if getattr(api, "_retries", 0) < 2:
            api._retries = getattr(api, "_retries", 0) + 1
            print(f"    [api] red inestable, reintento ({e})")
            time.sleep(2)
            return api(path, body, method)
        api._retries = 0
        return None


def wa_status():
    wurl = os.environ.get("WAHA_API_URL", "").rstrip("/")
    wkey = os.environ.get("WAHA_API_KEY", "")
    if not wurl or not wkey:
        return None
    req = urllib.request.Request(
        wurl + "/api/sessions", headers={"X-Api-Key": wkey}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            sessions = json.loads(res.read().decode())
            for s in sessions:
                if s.get("name") == os.environ.get("WAHA_SESSION_NAME", "tora-prod"):
                    return s.get("status")
            return None
    except Exception:
        return None


def save_prefs(page, phone, enabled, user_email):
    """Click de Guardar con reintentos (hidratación) + verificación en BD.
    La BD ya puede traer phone del seed: la verificación exige el teléfono
    EXACTO enviado (o vacío si se envió vacío), no solo non-null."""
    for _attempt in range(5):
        page.reload(wait_until="networkidle", timeout=90_000)
        page.wait_for_selector("#whatsapp-phone", timeout=60_000)
        page.wait_for_timeout(800)
        page.fill("#whatsapp-phone", phone or "")
        chk = page.locator('input[type="checkbox"]')
        if enabled != chk.is_checked():
            chk.click()
        btn = page.get_by_role("button", name="Guardar cambios")
        btn.click(timeout=10_000)
        # Fuente de verdad: la BD (no el toast efímero).
        for _i in range(20):
            time.sleep(1)
            row = api(
                "/users?email=eq."
                + urllib.parse.quote(user_email, safe="")
                + "&select=phone,whatsapp_enabled,whatsapp_opt_in_at"
            )
            if row and row[0]["whatsapp_enabled"] == enabled:
                saved_phone = row[0]["phone"] or ""
                if saved_phone == (phone or ""):
                    return row[0]
        # no aplicó: reintentar (el click pudo caer antes de hidratar)
    raise RuntimeError(f"save_prefs no aplicó (enabled={enabled})")


def login(page, email):
    """Login con espera de hidratación y reintento (patrón payment-methods.py).
    Limpia cookies antes: /login redirige si hay sesión viva."""
    page.context.clear_cookies()
    page.goto(BASE + "/login", wait_until="networkidle", timeout=90_000)
    email_input = page.locator('input[type="email"]')
    pw_input = page.locator('input[type="password"]')
    submit = page.locator('button[type="submit"]')
    email_input.wait_for(state="visible", timeout=60_000)
    email_input.fill(email)
    pw_input.fill(PW[email])
    for attempt in range(4):
        try:
            submit.click(timeout=5_000)
        except Exception:
            page.wait_for_timeout(1500)  # hidratación tardía
            continue
        for _i in range(15):
            page.wait_for_timeout(1000)
            if "/login" not in page.url:
                return
        if "/login" not in page.url:
            return
        # Reintento: rellenar de nuevo (el form pudo resetearse)
        email_input.fill(email)
        pw_input.fill(PW[email])
    raise RuntimeError(f"login falló para {email}")


def handle_password_gate(page, email):
    """Si el middleware manda a /cambiar-password, rota y persiste en .secrets."""
    if "/cambiar-password" not in page.url:
        return
    new_pw = "S1" + PW[email] + "!x"
    page.fill("#current-password", PW[email])
    page.fill("#new-password", new_pw)
    page.fill("#confirm-password", new_pw)
    page.get_by_role("button", name="Guardar contraseña").click()
    page.wait_for_timeout(1800)
    PW[email] = new_pw
    save_pw(email, new_pw)
    page.goto(BASE + "/", wait_until="domcontentloaded", timeout=90_000)
    page.wait_for_timeout(800)


def main():
    print("=== Sprint 3 E2E ===")
    wa = wa_status()
    print(f"WAHA session: {wa or 'no configurada'}")

    ops_email = "ops@tora.mx"
    fin_email = "finanzas@tora.mx"
    test_email = f"e2e-wa-{STAMP}@aceronorte.mx"

    # ── Fixture: usuario CLIENT_ADMIN pendiente → activar por service-role ──
    print("[fixture] creando usuario de prueba")
    req = urllib.request.Request(
        URL + "/auth/v1/admin/users",
        data=json.dumps({
            "email": test_email,
            "password": "E2eWa" + STAMP + "!x",  # noqa: fixture efímero
            "email_confirm": True,
            "user_metadata": {
                "full_name": "E2E WA " + STAMP,
                "role": "CLIENT_ADMIN",
                "tenant_id": ACERO,
            },
        }).encode(),
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            create = json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        print(f"    [admin create] HTTP {e.code}: {e.read().decode()[:150]}")
        create = None
    check("fixture: usuario creado", bool(create and create.get("id")))
    uid = create["id"] if create else None
    PW[test_email] = "E2eWa" + STAMP + "!x"  # para login del fixture
    time.sleep(1)
    # La fila public.users la crea el trigger handle_new_user: solo leerla.
    row = api(
        "/users?email=eq." + urllib.parse.quote(test_email, safe="") + "&select=id"
    )
    check("fixture: fila public.users (trigger)", bool(row))
    user_id = row[0]["id"] if row else None
    if user_id:
        # El trigger no propaga tenant_id desde metadata: asignarlo aquí.
        api("/users?id=eq." + user_id,
            {"status": "active", "tenant_id": ACERO}, method="PATCH")
        row = api(f"/users?id=eq.{user_id}&select=role,tenant_id,status")
        ok = bool(row and row[0]["tenant_id"] == ACERO
                  and row[0]["status"] == "active")
        check("fixture: usuario activado con tenant", ok)
    else:
        check("fixture: usuario activado con tenant", False, "sin fila")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.set_default_timeout(90_000)

        # ── 1. /perfil renderiza la card ──
        print("[1] perfil renderiza card WhatsApp")
        login(page, fin_email)
        page.goto(BASE + "/perfil", wait_until="networkidle", timeout=90_000)
        page.wait_for_selector("text=Notificaciones por WhatsApp", timeout=60_000)
        page.screenshot(path=f"{SHOTS}/01-perfil-whatsapp-card.png")
        check("1. card WhatsApp visible en /perfil", True)

        # ── 2. teléfono E.164 (+1 EE.UU., como el cliente real) sin activar ──
        print("[2] teléfono +1 sin activar")
        PHONE = "+1555123" + STAMP[-4:]
        save_prefs(page, PHONE, False, fin_email)
        fin = api(
            "/users?email=eq."
            + urllib.parse.quote(fin_email, safe="")
            + "&select=phone,whatsapp_enabled"
        )
        check("2. teléfono +1 persistido", fin and fin[0]["phone"] == PHONE,
              str(fin[0]["phone"] if fin else None))
        check("2b. whatsapp_enabled sigue false",
              bool(fin and fin[0]["whatsapp_enabled"] is False))

        # ── 3. activar sin teléfono → rechazo (validación servidor) ──
        print("[3] activar sin teléfono rechazado")
        rejected = False
        try:
            save_prefs(page, "", True, fin_email)
        except RuntimeError:
            rejected = True  # la BD nunca cambió: el servidor lo rechazó
        # Además probar el toast de validación cliente directamente.
        page.reload(wait_until="networkidle", timeout=90_000)
        page.wait_for_selector("#whatsapp-phone", timeout=60_000)
        page.fill("#whatsapp-phone", "")
        page.locator('input[type="checkbox"]').click()
        page.get_by_role("button", name="Guardar cambios").click(timeout=10_000)
        try:
            page.wait_for_selector("text=Teléfono inválido", timeout=8_000)
            rejected = True
        except Exception:
            pass
        check("3. activación sin teléfono rechazada", rejected)

        # ── 4. activar con teléfono +1 → opt-in persistido ──
        print("[4] activar con teléfono +1")
        row = save_prefs(page, PHONE, True, fin_email)
        check("4. whatsapp_enabled=true", row["whatsapp_enabled"] is True)
        check("4b. opt_in_at presente", bool(row["whatsapp_opt_in_at"]))
        page.screenshot(path=f"{SHOTS}/02-whatsapp-activado.png")

        # Desactivar de inmediato (higiene: no dejar opt-in real encendido).
        row = save_prefs(page, PHONE, False, fin_email)
        check("4c. desactivado de nuevo", row["whatsapp_enabled"] is False)

        # ── 5. flujo real: OPS cotiza y envía → notification in-app ──
        print("[5] hook de opciones enviadas")
        notif_before = api(
            f"/notifications?user_id=eq.{user_id}&select=id" if user_id else None
        ) if user_id else None
        n_before = len(notif_before) if notif_before else 0

        # Crear trip como el cliente fixture (sesión nueva: la de finanzas
        # sigue viva y /login redirige a usuarios autenticados).
        login(page, test_email)
        handle_password_gate(page, test_email)
        # Click con reintentos (hidratación); la BD es la fuente de verdad.
        n_before_trips = len(api(f"/trips?requester_id=eq.{user_id}&select=id") or [])
        trip_id = ""
        for _attempt in range(4):
            page.goto(BASE + "/trips/new", wait_until="networkidle", timeout=90_000)
            page.wait_for_selector('input[name="destination"]', timeout=60_000)
            page.wait_for_timeout(700)
            page.fill('input[name="destination"]', "Monterrey E2E WA " + STAMP)
            page.fill('input[name="origin"]', "CDMX")
            page.fill('input[name="departure_date"]', "2026-12-15")
            page.fill('input[name="passengers"]', "2")
            page.fill("#reason", "Reunión comercial E2E")
            try:
                page.get_by_role("button", name="Solicitar viaje").click(
                    timeout=10_000)
            except Exception:
                continue
            for _i in range(15):
                time.sleep(1)
                rows = api(f"/trips?requester_id=eq.{user_id}&select=id") or []
                if len(rows) > n_before_trips:
                    trip_id = rows[0]["id"]
                    break
            if trip_id:
                break
        check("5. trip fixture creado", len(trip_id) == 36, trip_id)

        # Opción de cotización insertada por service-role (patrón de las
        # suites probadas: la página OPS solo ajusta el net y envía).
        api("/trip_options", [{
            "trip_id": trip_id,
            "provider": "E2E Air " + STAMP,
            "net_price": 2400,
            "final_price": 3000,
            "currency": "MXN",
            "details": {"notas": "e2e whatsapp"},
        }])
        opt = api(f"/trip_options?trip_id=eq.{trip_id}&select=id")
        opt_id = opt[0]["id"] if opt else ""

        # OPS ajusta el net y envía al cliente (dialog → Enviar).
        login(page, ops_email)
        page.goto(BASE + f"/ops/trips/{trip_id}/quote",
                  wait_until="domcontentloaded")
        page.wait_for_selector("text=Opción 1", timeout=60_000)
        page.fill(f"#net-{opt_id}", "2400")
        page.wait_for_timeout(400)
        for _attempt in range(3):
            page.get_by_role("button", name="Enviar al cliente").click()
            dlg = page.get_by_role("dialog").get_by_role("button", name="Enviar")
            try:
                dlg.wait_for(state="visible", timeout=10_000)
                dlg.click()
                break
            except Exception:
                continue
        page.wait_for_url(lambda u: "/ops/inbox" in u, timeout=90_000)

        time.sleep(2)
        notifs = api(
            f"/notifications?user_id=eq.{user_id}"
            "&type=eq.trip_options_sent&select=id,type,payload"
        )
        check("5b. notification trip_options_sent creada",
              bool(notifs and len(notifs) > n_before),
              f"count={len(notifs) if notifs else 0}")

        # ── 6. WhatsApp real (solo si la sesión WAHA está WORKING) ──
        print("[6] WhatsApp real")
        if wa == "WORKING":
            # Re-activar opt-in del fixture con teléfono de prueba.
            api(f"/users?id=eq.{user_id}",
                {"phone": "+521551000" + STAMP[-4:], "whatsapp_enabled": True,
                 "whatsapp_opt_in_at": "2026-01-01T00:00:00Z"}, method="PATCH")
            # Enviar de nuevo (reenvío de opciones) → hook → WAHA.
            page.goto(BASE + f"/ops/trips/{trip_id}/quote",
                      wait_until="domcontentloaded")
            page.get_by_role("button", name="Enviar al cliente").first.click()
            confirm2 = page.get_by_role("button", name="Confirmar")
            if confirm2.count() > 0:
                confirm2.first.click()
            page.wait_for_url(lambda u: "/ops/inbox" in u, timeout=90_000)
            check("6. envío real disparado (sesión WORKING)", True)
            print("  → verificación visual del CEO: revisar el WhatsApp del chip")
        else:
            check("6. WhatsApp real omitido (sesión no WORKING — QR pendiente)",
                  True)
            print("  → SKIP: se ejecutará cuando el chip escanee el QR")

        page.screenshot(path=f"{SHOTS}/03-flujo-ops-envio.png")
        ctx.close()
        browser.close()

    # ── Limpieza verificada ──
    print("[cleanup]")
    # Restaurar el usuario de sesión al estado del seed (teléfono original,
    # sin opt-in) y limpiar huérfanos si la corrida murió a medias.
    req = urllib.request.Request(
        URL + "/rest/v1/users?email=eq." + urllib.parse.quote(fin_email, safe=""),
        data=json.dumps({"phone": "+52 81 0000 0003", "whatsapp_enabled": False,
                         "whatsapp_opt_in_at": None}).encode(),
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}",
                 "Content-Type": "application/json"},
        method="PATCH",
    )
    urllib.request.urlopen(req, timeout=30)

    def silent_delete(path):
        # PostgREST vive bajo /rest/v1; el Admin API de Auth bajo /auth/v1.
        full = URL + path if path.startswith("/auth/") else REST + path
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    full,
                    headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
                    method="DELETE",
                ),
                timeout=30,
            )
        except Exception as e:
            print(f"    [cleanup] {path.split('?')[0]}: {e}")

    if user_id:
        silent_delete("/notifications?user_id=eq." + user_id)
    if trip_id:
        silent_delete("/trip_options?trip_id=eq." + trip_id)
        silent_delete("/trips?id=eq." + trip_id)
    if user_id:
        silent_delete("/users?id=eq." + user_id)
    if uid:
        silent_delete("/auth/v1/admin/users/" + uid)
    time.sleep(1)
    residue = api(f"/users?id=eq.{user_id}&select=id") or []
    residue_t = api(f"/trips?id=eq.{trip_id}&select=id") or []
    residue_n = api(f"/notifications?user_id=eq.{user_id}&select=id") or []
    check("cleanup: residuo 0",
          len(residue) == 0 and len(residue_t) == 0 and len(residue_n) == 0)

    print(f"\n=== {len(PASS)} PASS / {len(FAIL)} FAIL ===")
    for f in FAIL:
        print("  FAIL:", f)
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
