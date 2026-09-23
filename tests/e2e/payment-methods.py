"""Sprint 1 E2E — flujos CASH y PREPAID completos con fixtures aislados."""
import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3210"
STAMP = str(int(time.time()))[-7:]
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SECRETS = ".secrets/passwords-20260921.txt"

ACERO = "b6eb151f-a417-4911-9314-0af8bedf06ce"
VCM = "1a354fee-8250-4253-8e7b-c2a2e0ec2506"

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


def storage_delete(object_path):
    req = urllib.request.Request(
        URL.replace("/v1", "") + "/storage/v1/object/receipts/" + object_path,
        method="DELETE",
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY},
    )
    try:
        urllib.request.urlopen(req).read()
    except Exception:
        pass


def passwords():
    out = {}
    with open(SECRETS) as f:
        for line in f:
            parts = line.strip().split(None, 1)
            if len(parts) == 2:
                out[parts[0]] = parts[1]
    return out


def save_passwords(pw):
    with open(SECRETS, "w") as f:
        for email, pwd in pw.items():
            f.write(f"{email} {pwd}\n")


PW = passwords()

def wait_server():
    for i in range(60):
        try:
            urllib.request.urlopen(BASE + "/login", timeout=5)
            return
        except Exception:
            time.sleep(2)


wait_server()


def login(page, email):
    page.context.clear_cookies()
    page.goto(BASE + "/login", wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(1000)
    page.fill("#email", email)
    page.fill("#password", PW[email])
    for attempt in range(3):
        page.get_by_role("button", name="Ingresar").click()
        for i in range(12):
            page.wait_for_timeout(1000)
            if "/login" not in page.url:
                break
        if "/login" not in page.url:
            break
    if "/cambiar-password" in page.url:
        new_pw = "S1" + PW[email] + "!x"
        page.fill("#current-password", PW[email])
        page.fill("#new-password", new_pw)
        page.fill("#confirm-password", new_pw)
        page.get_by_role("button", name="Guardar contraseña").click()
        page.wait_for_timeout(1800)
        PW[email] = new_pw
        page.goto(BASE + "/", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(800)


# ── Setup: VCM como tenant cash con CLABE (config, no lógica) ─────
api("PATCH", "/rest/v1/tenants?id=eq." + VCM, {
    "payment_method": "cash",
    "spei_clabe": "012180001234567890",
    "spei_beneficiary": "TORA SA de CV",
})
t = api("GET", f"/rest/v1/tenants?id=eq.{VCM}&select=payment_method")[0]
check("SETUP: VCM configurado como cash + CLABE", t["payment_method"] == "cash")

# ── Fixtures ──────────────────────────────────────────────────────
ops_user = api("GET", "/rest/v1/users?email=eq.ops@tora.mx&select=id")[0]

def make_trip(tenant_id, dest):
    row = api(
        "POST",
        "/rest/v1/trips",
        {
            "tenant_id": tenant_id,
            "requester_id": ops_user["id"],
            "status": "pending_quote",
            "payment_method_snapshot": "cash" if tenant_id == VCM else "prepaid",
            "origin": "E2E Origen " + STAMP,
            "destination": dest,
            "departure_date": "2026-10-20",
            "passengers": 1,
            "service_type": "flight",
            "reason": "e2e",
            "urgency": "normal",
        },
        prefer="return=representation",
    )[0]
    api("POST", "/rest/v1/trip_options", [
        {"trip_id": row["id"], "provider": "E2E Air " + STAMP, "net_price": 4000,
         "final_price": 5000, "currency": "MXN", "details": {"notas": "e2e"},
         "is_selected": False},
    ])
    api("PATCH", "/rest/v1/trips?id=eq." + row["id"], {"status": "options_sent"})
    opt = api("GET", f"/rest/v1/trip_options?trip_id=eq.{row['id']}&select=id")[0]
    return row["id"], opt["id"]


cash_trip_id, cash_opt_id = make_trip(VCM, "E2E Cash " + STAMP)
prepaid_trip_id, prepaid_opt_id = make_trip(ACERO, "E2E Prepaid " + STAMP)
print(f"fixtures: cash={cash_trip_id[:8]} prepaid={prepaid_trip_id[:8]}")


def click_select(page, trip_id, tries=4):
    """Click en Seleccionar con reintento; devuelve (status, body) de la
    respuesta /select o None. En dev el click puede caer antes de hidratar."""
    seen = []

    def on_response(resp):
        if "/select" in resp.url:
            try:
                seen.append((resp.status, resp.text()))
            except Exception:
                seen.append((resp.status, ""))

    page.on("response", on_response)
    try:
        for _ in range(tries):
            page.get_by_role("button", name="Seleccionar").first.click()
            for _ in range(10):
                page.wait_for_timeout(1000)
                if seen:
                    return seen[0]
    finally:
        page.remove_listener("response", on_response)
    return None


def ops_quote(page, trip_id, option_id, shot):
    login(page, "ops@tora.mx")
    page.goto(BASE + f"/ops/trips/{trip_id}/quote", wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(900)
    page.screenshot(path=f"/tmp/sprint1-payments/{shot}")
    # Click con reintentos: en dev el click puede caer antes de hidratar.
    for _attempt in range(3):
        page.fill(f"#net-{option_id}", "4000")
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Enviar al cliente").click()
        try:
            page.get_by_role("dialog").get_by_role("button", name="Enviar")\
                .click(timeout=8000)
            break
        except Exception:
            page.wait_for_timeout(1500)
    page.wait_for_timeout(1500)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ══ FLUJO CASH ════════════════════════════════════════════════
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.set_default_timeout(90000)

    ops_quote(page, cash_trip_id, cash_opt_id, "08-ops-trip-metodo.png")
    st = api("GET", f"/rest/v1/trips?id=eq.{cash_trip_id}&select=status")[0]["status"]
    check("CASH: cotización enviada (visible al cliente)",
          st in ("options_sent", "awaiting_selection"), st)

    login(page, "admin@vcm.mx")
    page.goto(BASE + "/dashboard", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(900)
    body = page.inner_text("body")
    check("CASH: dashboard muestra método 'Contado'", "Contado" in body)
    page.screenshot(path="/tmp/sprint1-payments/02-dashboard-cliente-cash.png")

    page.goto(BASE + "/trips/new", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(600)
    body = page.inner_text("body")
    check("CASH: banner en trips/new", "Este viaje se pagará con" in body)
    page.screenshot(path="/tmp/sprint1-payments/03-trips-new-aviso-metodo.png")

    for _attempt in range(3):
        page.goto(BASE + f"/trips/{cash_trip_id}", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(900)
        r = click_select(page, cash_trip_id)
        if r and r[0] == 200:
            break
    badge_ok = False
    for i in range(12):
        page.wait_for_timeout(2500)
        body = page.inner_text("body")
        if "Pendiente de pago" in body and "012180001234567890" in body:
            badge_ok = True
            break
    body = page.inner_text("body")
    check("CASH: trip en awaiting_payment (badge 'Pendiente de pago')",
          "Pendiente de pago" in body)
    check("CASH: instrucciones SPEI (CLABE + beneficiario)",
          "012180001234567890" in body and "TORA SA de CV" in body)
    check("CASH: referencia = id slice(0,8)", cash_trip_id[:8] in body)
    if not badge_ok:
        print("  [aviso] SPEI card no apareció en el polling; revisar snapshots")
    page.screenshot(path="/tmp/sprint1-payments/04-trip-detail-cash-instrucciones.png")

    page.goto(BASE + f"/wallet?trip={cash_trip_id}", wait_until="domcontentloaded", timeout=90000)
    sel_ok = False
    for i in range(10):
        page.wait_for_timeout(2000)
        body = page.inner_text("body")
        if "Aplicar a un viaje pendiente" in body and "E2E Cash" in body:
            sel_ok = True
            break
    body = page.inner_text("body")
    check("WALLET: select preseleccionado con el trip",
          "E2E Cash" in body and "Aplicar a un viaje pendiente" in body)
    page.screenshot(path="/tmp/sprint1-payments/05-wallet-upload-vinculado.png")

    receipt = Path(f"/tmp/e2e-receipt-{STAMP}.png")
    receipt.write_bytes(base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
        "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="))
    page.set_input_files("#receipt-file", str(receipt))
    page.fill("#amount", "5000")
    page.fill("#reference", "E2E" + STAMP)
    page.get_by_role("button", name="Enviar comprobante").click()
    page.wait_for_timeout(2500)

    dep = api(
        "GET",
        "/rest/v1/wallet_transactions?tenant_id=eq." + VCM
        + "&type=eq.deposit&status=eq.pending&related_trip_id=eq." + cash_trip_id
        + "&select=id,receipt_url",
    )
    check("WALLET: depósito creado vinculado al trip", len(dep) == 1)
    receipt_path = dep[0]["receipt_url"] if dep else None

    login(page, "finanzas@tora.mx")
    page.goto(BASE + "/finance/deposits", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(1200)
    row = page.locator("tr", has_text="E2E" + STAMP).first
    check("DEPOSITS: depósito E2E en cola", row.count() > 0)
    # click robusto: en dev el primer click puede caer antes de hidratar;
    # la fuente de verdad es la BD, no el toast
    for _attempt in range(4):
        page.wait_for_load_state("networkidle")
        row.get_by_role("button", name="Aprobar").click()
        page.wait_for_timeout(4000)
        _t = api("GET", f"/rest/v1/trips?id=eq.{cash_trip_id}&select=status")
        if _t and _t[0]["status"] == "confirmed":
            break
    page.wait_for_timeout(1500)

    t = api("GET", f"/rest/v1/trips?id=eq.{cash_trip_id}&select=status,paid_at")[0]
    check("CASH: trip confirmado", t["status"] == "confirmed", t["status"])
    check("CASH: paid_at poblado", t["paid_at"] is not None)
    ch = api("GET", "/rest/v1/wallet_transactions?related_trip_id=eq."
             + cash_trip_id + "&type=eq.charge&select=id,status,amount")
    check("CASH: charge completado", len(ch) == 1 and ch[0]["status"] == "completed")
    bk = api("GET", f"/rest/v1/bookings?trip_id=eq.{cash_trip_id}&select=confirmation_number")
    check("CASH: booking creado", len(bk) == 1 and len(bk[0]["confirmation_number"]) > 0)
    ctx.close()

    # ══ FLUJO PREPAID ═════════════════════════════════════════════
    ctx2 = browser.new_context(viewport={"width": 1440, "height": 900})
    page2 = ctx2.new_page()
    page2.set_default_timeout(90000)

    ops_quote(page2, prepaid_trip_id, prepaid_opt_id, "08-ops-trip-metodo-prepaid.png")
    st = api("GET", f"/rest/v1/trips?id=eq.{prepaid_trip_id}&select=status")[0]["status"]
    check("PREPAID: cotización enviada", st in ("options_sent", "awaiting_selection"), st)

    login(page2, "admin@aceronorte.mx")
    page2.goto(BASE + "/dashboard", wait_until="domcontentloaded", timeout=90000)
    page2.wait_for_timeout(900)
    body = page2.inner_text("body")
    check("PREPAID: dashboard muestra método 'Prepago'", "Prepago" in body)
    page2.screenshot(path="/tmp/sprint1-payments/01-dashboard-cliente-prepaid.png")

    bal = api("GET", "/rest/v1/wallet_transactions?tenant_id=eq." + ACERO
              + "&status=eq.completed&select=amount,type")
    baln = sum(float(x["amount"]) * (1 if x["type"] in ("deposit", "refund") else -1) for x in bal)
    check("PREPAID: saldo > 0 en BD", baln > 0, f"{baln:.2f}")

    for _attempt in range(3):
        page2.goto(BASE + f"/trips/{prepaid_trip_id}", wait_until="domcontentloaded", timeout=90000)
        page2.wait_for_timeout(900)
        r = click_select(page2, prepaid_trip_id)
        if r and r[0] == 200:
            break
    page2.wait_for_timeout(3000)
    body = page2.inner_text("body")
    check("PREPAID: confirmación visible ('Confirmado')", "Confirmado" in body)

    t = api("GET", f"/rest/v1/trips?id=eq.{prepaid_trip_id}&select=status,paid_at")[0]
    check("PREPAID: trip confirmado en BD", t["status"] == "confirmed", t["status"])
    ch = api("GET", "/rest/v1/wallet_transactions?tenant_id=eq." + ACERO
             + "&type=eq.charge&status=eq.completed&reference=eq.TRIP-"
             + prepaid_trip_id[:8] + "&select=id,amount,reference")
    check("PREPAID: cargo completado en wallet (por referencia)",
          len(ch) == 1 and abs(float(ch[0]["amount"]) - 5000.0) < 0.01)

    # 09 — mobile 375
    ctx3 = browser.new_context(viewport={"width": 375, "height": 812})
    page3 = ctx3.new_page()
    page3.set_default_timeout(90000)
    page3.goto(BASE + "/dashboard", wait_until="domcontentloaded", timeout=90000)
    page3.wait_for_timeout(900)
    page3.screenshot(path="/tmp/sprint1-payments/09-mobile-375.png")
    ctx3.close()
    ctx2.close()

    # 06/07 — admin tenants
    ctx4 = browser.new_context(viewport={"width": 1440, "height": 900})
    page4 = ctx4.new_page()
    page4.set_default_timeout(90000)
    login(page4, "admin@tora.mx")
    page4.goto(BASE + "/admin/tenants", wait_until="domcontentloaded", timeout=90000)
    page4.wait_for_timeout(1000)
    body = page4.inner_text("body")
    check("ADMIN: badges de método visibles (Prepago/Contado)", "Prepago" in body and "Contado" in body)
    page4.screenshot(path="/tmp/sprint1-payments/07-admin-columna-metodo.png")
    page4.get_by_role("button", name="Editar").first.click()
    page4.wait_for_timeout(700)
    page4.screenshot(path="/tmp/sprint1-payments/06-admin-editar-tenant.png")
    ctx4.close()
    browser.close()

# ── Limpieza + residuos ───────────────────────────────────────────
for tid in (cash_trip_id, prepaid_trip_id):
    api("DELETE", "/rest/v1/bookings?trip_id=eq." + tid)
    txs = api("GET", "/rest/v1/wallet_transactions?related_trip_id=eq." + tid + "&select=id,receipt_url")
    for tx in txs:
        if tx.get("receipt_url"):
            storage_delete(tx["receipt_url"])
    api("DELETE", "/rest/v1/wallet_transactions?related_trip_id=eq." + tid)
    api("DELETE", "/rest/v1/notifications?payload-%3E%3Etrip_id=eq." + tid)
    api("DELETE", "/rest/v1/trip_options?trip_id=eq." + tid)
    api("DELETE", "/rest/v1/trips?id=eq." + tid)

residual = (
    api("GET", "/rest/v1/trips?id=in.(" + cash_trip_id + "," + prepaid_trip_id + ")")
    + api("GET", "/rest/v1/wallet_transactions?related_trip_id=in.("
          + cash_trip_id + "," + prepaid_trip_id + ")")
)
check("Limpieza: residuo = 0 (trips + wallet)", len(residual) == 0, str(len(residual)))

save_passwords(PW)

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} checks PASS")
if failed:
    print("FALLOS: " + "; ".join(failed))
sys.exit(1 if failed else 0)
