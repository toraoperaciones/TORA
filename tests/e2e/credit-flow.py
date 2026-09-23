"""Sprint 2 E2E — flujo CREDIT completo: cupo, bloqueo, settle, cron de mora."""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3210"
STAMP = str(int(time.time()))[-7:]
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SECRETS = ".secrets/passwords-20260921.txt"
SHOTS = "/tmp/sprint2-credit"

results = []


def check(name, ok, detail=""):
    results.append((name, ok))
    print(("PASS" if ok else "FAIL") + f" — {name}" + (f" ({detail})" if detail else ""))


def api(method, path, payload=None, prefer=None):
    req = urllib.request.Request(
        URL + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={
            "apikey": KEY,
            "Authorization": "Bearer " + KEY,
            "Content-Type": "application/json",
            **({"Prefer": prefer} if prefer else {}),
        },
    )
    with urllib.request.urlopen(req) as r:
        body = r.read().decode()
        return json.loads(body) if body else None


def admin_api(method, path, payload=None):
    """Auth Admin API (sin header Prefer: rompe el POST)."""
    req = urllib.request.Request(
        URL.replace("/v1", "") + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY,
                 "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read().decode()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        return {"_status": e.code}


def passwords():
    out = {}
    with open(SECRETS) as f:
        for line in f:
            parts = line.strip().split(None, 1)
            if len(parts) == 2:
                out[parts[0]] = parts[1]
    return out


def ci(text):
    """Case-insensitive: labels con CSS uppercase devuelven MAYÚSCULAS."""
    return text.lower()


def click_until_response(page, loc, url_frag, tries=4):
    """Click con reintento hasta ver la respuesta de red esperada.
    En dev el click puede caer antes de la hidratación de React; la
    evidencia confiable es la respuesta HTTP, no el efecto visual."""
    seen = []

    def on_response(resp):
        if url_frag in resp.url:
            try:
                seen.append((resp.status, resp.text()))
            except Exception:
                seen.append((resp.status, ""))

    page.on("response", on_response)
    try:
        for _ in range(tries):
            loc.click()
            for _ in range(10):
                page.wait_for_timeout(1000)
                if seen:
                    return seen[0]
    finally:
        page.remove_listener("response", on_response)
    return None


def save_passwords(pw):
    with open(SECRETS, "w") as f:
        for email, pwd in pw.items():
            f.write(f"{email} {pwd}\n")


PW = passwords()


def wait_server():
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE + "/login", timeout=5)
            return
        except Exception:
            time.sleep(2)


wait_server()


def login(page, email):
    page.context.clear_cookies()
    page.goto(BASE + "/login", wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.fill("#email", email)
    page.fill("#password", PW[email])
    for _attempt in range(3):
        page.get_by_role("button", name="Ingresar").click()
        for _ in range(12):
            page.wait_for_timeout(1000)
            if "/login" not in page.url:
                break
        if "/login" not in page.url:
            break
    if "/cambiar-password" in page.url:
        new_pw = "S2" + PW[email] + "!y"
        page.fill("#current-password", PW[email])
        page.fill("#new-password", new_pw)
        page.fill("#confirm-password", new_pw)
        page.get_by_role("button", name="Guardar contraseña").click()
        page.wait_for_timeout(1800)
        PW[email] = new_pw
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(800)


# ── Setup: tenant + usuario + trips fixture (service-role) ─────────
client_email = "client.e2e." + STAMP + "@test-credit.mx"
client_pw = "E2e-" + STAMP + "-Cred1!"

tenant = api("POST", "/rest/v1/tenants", {
    "name": "E2E Credit SA de CV " + STAMP,
    "rfc": "ECL" + STAMP + "XXX",
    "payment_method": "credit",
    "credit_limit": 50000,
    "credit_used": 0,
    "credit_days": 30,
    "markup_flights": 0.08,
    "markup_hotels": 0.1,
    "markup_cars": 0.1,
    "markup_stands": 0.1,
    "status": "active",
}, prefer="return=representation")[0]
check("SETUP: tenant credit creado (límite $50,000)", tenant["payment_method"] == "credit")

# Tenant aparte para los fixtures de mora: sus trips confirmados sin pagar
# cuentan contra SU línea, no contra la del flujo principal.
mora_tenant = api("POST", "/rest/v1/tenants", {
    "name": "E2E Mora SA de CV " + STAMP,
    "rfc": "EMO" + STAMP + "XXX",
    "payment_method": "credit",
    "credit_limit": 500000,
    "credit_used": 0,
    "credit_days": 30,
    "markup_flights": 0.08,
    "markup_hotels": 0.1,
    "markup_cars": 0.1,
    "markup_stands": 0.1,
    "status": "active",
}, prefer="return=representation")[0]

au = admin_api("POST", "/auth/v1/admin/users", {
    "email": client_email, "password": client_pw, "email_confirm": True,
})
au_id = au.get("id") if isinstance(au, dict) and au.get("id") else None
check("SETUP: auth user creado", bool(au_id))

existing = api("GET", f"/rest/v1/users?email=eq.{client_email}&select=id")
if existing:
    api("PATCH", "/rest/v1/users?id=eq." + au_id, {
        "tenant_id": tenant["id"], "role": "CLIENT_ADMIN", "status": "active",
    })
else:
    api("POST", "/rest/v1/users", {
        "id": au_id, "email": client_email, "full_name": "E2E Credit Client",
        "tenant_id": tenant["id"], "role": "CLIENT_ADMIN", "status": "active",
    })
u = api("GET", f"/rest/v1/users?email=eq.{client_email}&select=id,tenant_id,role,status")[0]
check("SETUP: usuario CLIENT_ADMIN activo en tenant",
      u["role"] == "CLIENT_ADMIN" and u["status"] == "active" and u["tenant_id"] == tenant["id"])

ops_user = api("GET", "/rest/v1/users?email=eq.ops@tora.mx&select=id")[0]
PW[client_email] = client_pw

today = date.today()


def make_credit_trip(dest, price, tenant_row=None, due_offset=None, confirmed=False):
    """Trip fixture; opcionalmente confirmado con vencimiento (cron tests)."""
    payload = {
        "tenant_id": (tenant_row or tenant)["id"],
        "requester_id": ops_user["id"],
        "status": "confirmed" if confirmed else "pending_quote",
        "payment_method_snapshot": "credit",
        "origin": "E2E Origen " + STAMP,
        "destination": dest,
        "departure_date": "2026-10-20",
        "passengers": 1,
        "service_type": "flight",
        "reason": "e2e",
        "urgency": "normal",
    }
    if due_offset is not None:
        payload["credit_due_date"] = (today + timedelta(days=due_offset)).isoformat()
    row = api("POST", "/rest/v1/trips", payload, prefer="return=representation")[0]
    api("POST", "/rest/v1/trip_options", [
        {"trip_id": row["id"], "provider": "E2E Air " + STAMP, "net_price": price * 0.8,
         "final_price": price, "currency": "MXN", "details": {"notas": "e2e"},
         "is_selected": confirmed},
    ])
    api("PATCH", "/rest/v1/trips?id=eq." + row["id"],
        {"status": "options_sent"} if not confirmed else {})
    opt = api("GET", f"/rest/v1/trip_options?trip_id=eq.{row['id']}&select=id")[0]
    return row["id"], opt["id"]


trip1_id, _o1 = make_credit_trip("E2E Cancun " + STAMP, 20000)
trip2_id, _o2 = make_credit_trip("E2E Monterrey " + STAMP, 40000)
trip3_id, _o3 = make_credit_trip("E2E Mora " + STAMP, 120000,
                                 tenant_row=mora_tenant, due_offset=-45, confirmed=True)
# Usuario del tenant de mora para poder ver sus trips por RLS.
mora_email = "mora.e2e." + STAMP + "@test-credit.mx"
mora_au = admin_api("POST", "/auth/v1/admin/users", {
    "email": mora_email, "password": client_pw, "email_confirm": True,
})
mora_au_id = mora_au.get("id") if isinstance(mora_au, dict) else None
PW[mora_email] = client_pw
if mora_au_id:
    if api("GET", f"/rest/v1/users?id=eq.{mora_au_id}&select=id"):
        api("PATCH", "/rest/v1/users?id=eq." + mora_au_id, {
            "tenant_id": mora_tenant["id"], "role": "CLIENT_ADMIN", "status": "active",
        })
    else:
        api("POST", "/rest/v1/users", {
            "id": mora_au_id, "email": mora_email, "full_name": "E2E Mora Client",
            "tenant_id": mora_tenant["id"], "role": "CLIENT_ADMIN", "status": "active",
        })
trip4_id, _o4 = make_credit_trip("E2E Susp " + STAMP, 8000,
                                 tenant_row=mora_tenant, due_offset=-91, confirmed=True)
print("fixtures listos")


def ops_quote(page, trip_id, option_id):
    login(page, "ops@tora.mx")
    page.goto(BASE + f"/ops/trips/{trip_id}/quote", wait_until="domcontentloaded")
    page.wait_for_timeout(900)
    page.fill(f"#net-{option_id}", str(int(20000 * 0.8 if trip_id == trip1_id else 40000 * 0.8)))
    page.wait_for_timeout(400)
    page.get_by_role("button", name="Enviar al cliente").click()
    page.get_by_role("dialog").get_by_role("button", name="Enviar").click()
    page.wait_for_timeout(1500)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.set_default_timeout(90000)

    # ── 1. Cliente ve su método crédito ─────────────────────────────
    login(page, client_email)
    page.goto(BASE + "/dashboard", wait_until="domcontentloaded")
    page.wait_for_timeout(1000)
    body = page.inner_text("body")
    check("CREDIT: dashboard muestra 'Crédito' + disponible",
          "Crédito" in body and "50,000" in body)
    page.screenshot(path=f"{SHOTS}/01-dashboard-cliente-credit.png")

    page.goto(BASE + "/trips/new", wait_until="domcontentloaded")
    page.wait_for_timeout(700)
    body = page.inner_text("body")
    check("CREDIT: banner trips/new con disponible",
          "Este viaje se pagará con" in body and "50,000" in body)

    # ── 2. Trip 1: seleccionar → confirmado a 30 días ───────────────
    ops_quote(page, trip1_id, _o1)
    login(page, client_email)
    ok_ui = False
    for _attempt in range(3):
        page.goto(BASE + f"/trips/{trip1_id}", wait_until="networkidle")
        page.wait_for_timeout(800)
        r = click_until_response(
            page, page.get_by_role("button", name="Seleccionar").first,
            "/select", tries=3)
        if r and r[0] == 200:
            ok_ui = True
            break
    check("CREDIT: trip1 confirmado en UI", ok_ui)
    for _ in range(6):
        page.wait_for_timeout(2000)
        if "confirmado" in ci(page.inner_text("body")):
            break
    page.screenshot(path=f"{SHOTS}/03b-trip1-confirmado.png")
    body = page.inner_text("body")
    check("CREDIT: trip detail muestra vencimiento + interés",
          "2.5%" in ci(body) and "día 31" in ci(body))
    page.screenshot(path=f"{SHOTS}/03-trip-detail-credit.png")

    t1 = api("GET", f"/rest/v1/trips?id=eq.{trip1_id}&select=status,credit_due_date,paid_at")[0]
    expected_due = (today + timedelta(days=30)).isoformat()
    check("CREDIT: trip1 BD — confirmed + due hoy+30 + sin pagar",
          t1["status"] == "confirmed" and t1["credit_due_date"] == expected_due
          and t1["paid_at"] is None,
          f"{t1['status']}/{t1['credit_due_date']}")
    tn = api("GET", f"/rest/v1/tenants?id=eq.{tenant['id']}&select=credit_used")[0]
    check("CREDIT: credit_used = 20000", abs(float(tn["credit_used"]) - 20000) < 0.01,
          str(tn["credit_used"]))
    ch1 = api("GET", "/rest/v1/wallet_transactions?related_trip_id=eq." + trip1_id
              + "&type=eq.charge&select=id,status,reference")
    check("CREDIT: charge CREDIT- pendiente con related_trip_id",
          len(ch1) == 1 and ch1[0]["status"] == "pending"
          and ch1[0]["reference"].startswith("CREDIT-"))

    # ── 3. Trip 2: bloqueado por cupo ($30,000 disp < $40,000) ──────
    ops_quote(page, trip2_id, _o2)
    login(page, client_email)
    r400 = None
    for _attempt in range(3):
        page.goto(BASE + f"/trips/{trip2_id}", wait_until="networkidle")
        page.wait_for_timeout(800)
        r400 = click_until_response(
            page, page.get_by_role("button", name="Seleccionar").first,
            "/select", tries=3)
        if r400 and r400[0] == 400:
            break
    blocked = bool(r400) and r400[0] == 400 and "Crédito insuficiente" in r400[1]
    check("CREDIT: bloqueo — HTTP 400 con 'Crédito insuficiente'", blocked,
          (r400[0] if r400 else None).__str__())
    page.screenshot(path=f"{SHOTS}/05-bloqueo-credito-insuficiente.png")
    t2 = api("GET", f"/rest/v1/trips?id=eq.{trip2_id}&select=status")[0]["status"]
    ch2 = api("GET", "/rest/v1/wallet_transactions?related_trip_id=eq." + trip2_id
              + "&type=eq.charge&select=id")
    check("CREDIT: bloqueo — BD sin cargo ni confirmación",
          t2 in ("options_sent", "awaiting_selection") and len(ch2) == 0, t2)

    # ── 4. FINANCE: KPIs + cartera + settle ─────────────────────────
    login(page, "finanzas@tora.mx")
    page.goto(BASE + "/finance/credit", wait_until="domcontentloaded")
    page.wait_for_timeout(1200)
    body = page.inner_text("body")
    check("FINANCE: KPIs visibles (Crédito otorgado/Utilizado/Disponible)",
          "crédito otorgado" in ci(body) and "crédito utilizado" in ci(body)
          and "disponible" in ci(body))
    check("FINANCE: cartera muestra trip1", "E2E Cancun" in body)
    page.screenshot(path=f"{SHOTS}/06-finance-credit-kpis.png")

    row1 = page.locator("tr", has_text="E2E Cancun").first
    row1.get_by_role("button", name="Marcar como pagado").click()
    page.wait_for_timeout(600)
    page.screenshot(path=f"{SHOTS}/08-settle-dialog.png")
    page.fill(f"#settle-ref-{trip1_id}", "SPEI-TEST-001")
    page.get_by_role("dialog").get_by_role("button", name="Marcar como pagado").click()
    settled = False
    for _ in range(10):
        page.wait_for_timeout(1500)
        if "Crédito liquidado" in page.inner_text("body"):
            settled = True
            break
    check("FINANCE: settle — toast 'Crédito liquidado'", settled)
    page.screenshot(path=f"{SHOTS}/07-finance-credit-tabla-vencidos.png")

    tn = api("GET", f"/rest/v1/tenants?id=eq.{tenant['id']}&select=credit_used")[0]
    check("FINANCE: settle — credit_used vuelve a 0",
          abs(float(tn["credit_used"])) < 0.01, str(tn["credit_used"]))
    t1 = api("GET", f"/rest/v1/trips?id=eq.{trip1_id}&select=paid_at")[0]
    check("FINANCE: settle — trip1 pagado", t1["paid_at"] is not None)
    cp = api("GET", "/rest/v1/wallet_transactions?related_trip_id=eq." + trip1_id
             + "&type=eq.credit_payment&select=id,status")
    check("FINANCE: settle — credit_payment completado",
          len(cp) == 1 and cp[0]["status"] == "completed")
    ch1 = api("GET", "/rest/v1/wallet_transactions?related_trip_id=eq." + trip1_id
              + "&type=eq.charge&select=id,status")
    check("FINANCE: settle — charge original completado",
          len(ch1) == 1 and ch1[0]["status"] == "completed")

    # ── 5. Retry trip2: ahora sí cabe ($50,000 disp ≥ $40,000) ──────
    login(page, client_email)
    ok_ui2 = False
    for _attempt in range(3):
        page.goto(BASE + f"/trips/{trip2_id}", wait_until="networkidle")
        page.wait_for_timeout(800)
        r2 = click_until_response(
            page, page.get_by_role("button", name="Seleccionar").first,
            "/select", tries=3)
        if r2 and r2[0] == 200:
            ok_ui2 = True
            break
    check("CREDIT: retry trip2 confirmado tras liquidar", ok_ui2)
    tn = api("GET", f"/rest/v1/tenants?id=eq.{tenant['id']}&select=credit_used")[0]
    check("CREDIT: credit_used = 40000 tras trip2",
          abs(float(tn["credit_used"]) - 40000) < 0.01, str(tn["credit_used"]))

    # ── 6. Cron de mora: interés (45d) + suspensión (91d) ───────────
    mora = api("POST", "/rest/v1/rpc/apply_credit_mora", {})
    check("CRON: apply_credit_mora ejecuta", isinstance(mora, dict) and mora.get("ok") is True,
          json.dumps(mora))
    interest = api("GET", "/rest/v1/wallet_transactions?related_trip_id=eq." + trip3_id
                   + "&type=eq.interest&select=id,amount")
    check("CRON: interés aplicado a trip3 (45d vencido)",
          len(interest) == 1 and abs(float(interest[0]["amount"]) - 120000 * 0.000833) < 1,
          str(interest[0]["amount"]) if interest else "sin tx")
    t4 = api("GET", f"/rest/v1/trips?id=eq.{trip4_id}&select=status")[0]["status"]
    check("CRON: trip4 suspendido (91d vencido)", t4 == "suspended", t4)

    # Banner de suspensión en UI cliente (con el usuario del tenant de mora)
    try:
        login(page, mora_email)
        page.goto(BASE + f"/trips/{trip4_id}", wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        body = page.inner_text("body")
        check("UI: trip4 banner 'suspendido por mora'",
              "suspendido por mora" in ci(body) and "Contactar a TORA" in body)
        page.screenshot(path=f"{SHOTS}/04-trip-suspended.png")
    except Exception as e:
        check("UI: trip4 banner 'suspendido por mora'", False, e.__class__.__name__)

    # ── 7. Banner 'cerca del límite' (uso 90%) ──────────────────────
    api("PATCH", "/rest/v1/tenants?id=eq." + tenant["id"], {"credit_used": 45000})
    login(page, client_email)  # el paso anterior cambió de sesión (mora)
    page.goto(BASE + "/dashboard", wait_until="domcontentloaded")
    page.wait_for_timeout(1000)
    body = page.inner_text("body")
    check("UI: dashboard 'cerca del límite' (uso >80%)",
          "estás cerca del límite" in ci(body))
    page.screenshot(path=f"{SHOTS}/02-dashboard-credit-cerca-limite.png")

    # ── 8. Mobile 375 (no-fatal) ─────────────────────────────────
    try:
        mctx = browser.new_context(viewport={"width": 375, "height": 812})
        mpage = mctx.new_page()
        mpage.goto(BASE + "/dashboard", wait_until="domcontentloaded")
        mpage.wait_for_timeout(900)
        mpage.screenshot(path=f"{SHOTS}/10-mobile-375.png")
        mctx.close()
    except Exception as e:
        print("aviso mobile:", e.__class__.__name__)
    ctx.close()

    # ── 9. Admin: editar credit_limit (screenshot, no-fatal) ─────
    try:
        actx = browser.new_context(viewport={"width": 1440, "height": 900})
        apage = actx.new_page()
        for _attempt in range(3):
            try:
                login(apage, "admin@tora.mx")
                break
            except Exception:
                apage = actx.new_page()
                wait_server()
        apage.goto(BASE + "/admin/tenants", wait_until="domcontentloaded")
        apage.wait_for_timeout(1000)
        apage.screenshot(path=f"{SHOTS}/09-admin-edit-credit-limit.png")
        actx.close()
    except Exception as e:
        print("aviso admin:", e.__class__.__name__)
    browser.close()

# ── Limpieza + residuos ───────────────────────────────────────────
for tid in (trip1_id, trip2_id, trip3_id, trip4_id):
    api("DELETE", "/rest/v1/bookings?trip_id=eq." + tid)
    txs = api("GET", "/rest/v1/wallet_transactions?related_trip_id=eq." + tid
              + "&select=id,receipt_url")
    for tx in txs:
        if tx.get("receipt_url"):
            req = urllib.request.Request(
                URL.replace("/v1", "") + "/storage/v1/object/receipts/" + tx["receipt_url"],
                method="DELETE",
                headers={"apikey": KEY, "Authorization": "Bearer " + KEY},
            )
            try:
                urllib.request.urlopen(req).read()
            except Exception:
                pass
    api("DELETE", "/rest/v1/wallet_transactions?related_trip_id=eq." + tid)
    api("DELETE", "/rest/v1/notifications?payload-%3E%3Etrip_id=eq." + tid)
    api("DELETE", "/rest/v1/trip_options?trip_id=eq." + tid)
    api("DELETE", "/rest/v1/trips?id=eq." + tid)

api("DELETE", f"/rest/v1/users?email=eq.{urllib.parse.quote(client_email)}")
admin_api("DELETE", "/auth/v1/admin/users/" + au_id)
if mora_au_id:
    api("DELETE", f"/rest/v1/users?email=eq.{urllib.parse.quote(mora_email)}")
    admin_api("DELETE", "/auth/v1/admin/users/" + mora_au_id)
api("DELETE", "/rest/v1/tenants?id=eq." + tenant["id"])
api("DELETE", "/rest/v1/tenants?id=eq." + mora_tenant["id"])

residual = (
    api("GET", "/rest/v1/trips?id=in.(%s,%s,%s,%s)" % (trip1_id, trip2_id, trip3_id, trip4_id))
    + api("GET", "/rest/v1/wallet_transactions?related_trip_id=in.(%s,%s,%s,%s)"
          % (trip1_id, trip2_id, trip3_id, trip4_id))
    + api("GET", "/rest/v1/tenants?id=in.(%s,%s)" % (tenant["id"], mora_tenant["id"]))
    + api("GET", f"/rest/v1/users?email=eq.{client_email}")
    + api("GET", f"/rest/v1/users?email=eq.{mora_email}")
)
auth_gone = admin_api("GET", "/auth/v1/admin/users/" + au_id)
auth_residual = not (isinstance(auth_gone, dict) and auth_gone.get("_status") == 404)
check("Limpieza: residuo = 0 (trips/wallet/tenant/users/auth)",
      len(residual) == 0 and not auth_residual, f"{len(residual)} filas, auth={auth_residual}")

save_passwords(PW)

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} checks PASS")
if failed:
    print("FALLOS: " + "; ".join(failed))
