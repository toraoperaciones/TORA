"""Sprint 4 E2E — compliance: legales, register con checkbox, tickets, export.

Ejercicio real contra dev server (puerto 3210) y BD de producción:
  1. /aviso-privacidad y /terminos públicas con banner de plantilla.
  2. Register bloquea sin checkbox; con checkbox persiste el registro.
  3. users.accepted_terms_at / accepted_privacy_at poblados (trigger 0024).
  4. /soporte: crear ticket y verlo en la lista propia.
  5. Export JSON de facturación (admin): descarga con estructura CFDI válida.

Contraseñas de .secrets (nunca impresas). Cleanup verificado (residuo 0).
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
REST = URL + "/rest/v1"
SECRETS = ".secrets/passwords-20260921.txt"
SHOTS = "/tmp/sprint4-legal"
os.makedirs(SHOTS, exist_ok=True)

STAMP = str(int(time.time()))[-7:]
PASS = []
FAIL = []


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
        print(f"  PASS  {name}")
    else:
        FAIL.append(f"{name} {detail}")
        print(f"  FAIL  {name}  {detail}")


def api(path, body=None, method=None):
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
        print(f"    [api {method} {path.split('?')[0]}] HTTP {e.code}")
        return None


def passwords():
    out = {}
    with open(SECRETS) as f:
        for line in f:
            parts = line.strip().split(None, 1)
            if len(parts) == 2:
                out[parts[0]] = parts[1]
    return out


PW = passwords()


def login(page, email):
    page.context.clear_cookies()
    page.goto(BASE + "/login", wait_until="networkidle", timeout=90_000)
    email_input = page.locator('input[type="email"]')
    pw_input = page.locator('input[type="password"]')
    submit = page.locator('button[type="submit"]')
    email_input.wait_for(state="visible", timeout=60_000)
    email_input.fill(email)
    pw_input.fill(PW[email])
    for _attempt in range(4):
        try:
            submit.click(timeout=10_000)
        except Exception:
            page.wait_for_timeout(1500)
            continue
        for _i in range(15):
            page.wait_for_timeout(1000)
            if "/login" not in page.url:
                return
    raise RuntimeError(f"login falló para {email}")


def save_pw(email, new_pw):
    with open(SECRETS, encoding="utf-8") as fh:
        lines = fh.readlines()
    with open(SECRETS, "w", encoding="utf-8") as fh:
        for line in lines:
            fh.write(f"{email} {new_pw}\n" if line.startswith(email + " ") else line)


def main():
    print("=== Sprint 4 E2E compliance ===")

    # ── 1. Páginas legales públicas ──
    print("[1] páginas legales")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.set_default_timeout(90_000)

        for path, title in [
            ("/aviso-privacidad", "Aviso de Privacidad"),
            ("/terminos", "Términos y Condiciones"),
        ]:
            res = page.goto(BASE + path, wait_until="domcontentloaded", timeout=90_000)
            ok = res is not None and res.status == 200
            body = page.inner_text("body")
            check(f"1. {path} 200", ok)
            check(f"1b. {path} banner plantilla",
                  "plantilla" in body and "abogado" in body)

        # ── 2/3. Register: bloqueo sin checkbox + timestamps con checkbox ──
        print("[2] register sin checkbox")
        page.goto(BASE + "/register", wait_until="networkidle", timeout=90_000)
        page.wait_for_selector("#fullName", timeout=60_000)
        test_email = f"e2e-legal-{STAMP}@test-legal.mx"
        test_pw = "Sprint4" + STAMP + "!x"
        page.fill("#fullName", "E2E Legal " + STAMP)
        page.fill("#email", test_email)
        page.fill("#password", test_pw)
        page.get_by_role("button", name="Crear cuenta").click()
        page.wait_for_timeout(1500)
        still_on_register = "/register" in page.url
        page.screenshot(path=f"{SHOTS}/04-register-error-sin-checkbox.png")
        check("2. register bloqueado sin checkbox", still_on_register)
        check("2b. mensaje visible",
              "Debes aceptar los términos" in page.inner_text("body"))
        page.screenshot(path=f"{SHOTS}/03-register-checkbox.png")

        print("[3] register con checkbox")
        page.locator("#acceptTerms").check()
        page.get_by_role("button", name="Crear cuenta").click()
        page.wait_for_url(lambda u: "/pending" in u, timeout=90_000)
        time.sleep(1)
        rows = api("/users?email=eq." + urllib.parse.quote(test_email, safe=""))
        check("3. fila users creada", bool(rows))
        if rows:
            check("3b. accepted_terms_at poblado",
                  bool(rows[0].get("accepted_terms_at")))
            check("3c. accepted_privacy_at poblado",
                  bool(rows[0].get("accepted_privacy_at")))

        # ── 4. /soporte: crear ticket y verlo en la lista ──
        print("[4] ticket de soporte")
        # El fixture queda pending_approval (no puede loguear). Activar + tenant.
        if rows:
            api("/users?id=eq." + rows[0]["id"],
                {"status": "active"}, method="PATCH")
        # Usar finanzas@tora.mx (cuenta activa del seed) para el ticket.
        login(page, "finanzas@tora.mx")
        page.goto(BASE + "/soporte", wait_until="networkidle", timeout=90_000)
        page.wait_for_selector("#ticket-subject", timeout=60_000)
        page.wait_for_timeout(700)
        subject = "E2E Ticket Sprint 4 " + STAMP
        created = False
        for _attempt in range(4):
            page.reload(wait_until="networkidle", timeout=90_000)
            page.wait_for_selector("#ticket-subject", timeout=60_000)
            page.wait_for_timeout(600)
            page.fill("#ticket-subject", subject)
            page.fill("#ticket-description",
                      "Ticket de prueba automatizada del Sprint 4: flujo de soporte.")
            page.get_by_role("button", name="Crear ticket").click(timeout=10_000)
            for _i in range(12):
                time.sleep(1)
                found = api("/support_tickets?subject=eq."
                            + urllib.parse.quote(subject))
                if found:
                    created = True
                    break
            if created:
                break
        check("4. ticket creado en BD", created)
        page.screenshot(path=f"{SHOTS}/05-soporte-page.png")
        body = page.inner_text("body")
        check("4b. ticket visible en lista propia", subject in body)

        # ── 5. Export JSON ──
        print("[5] export JSON facturación")
        login(page, "admin@tora.mx")
        page.goto(BASE + "/admin/invoices", wait_until="networkidle",
                  timeout=90_000)
        page.wait_for_selector("text=Descargar JSON", timeout=60_000)
        page.get_by_role("button", name="Descargar JSON para timbrado").click()
        page.wait_for_selector("#export-tenant", timeout=30_000)
        page.screenshot(path=f"{SHOTS}/08-admin-export-json.png")
        # Generar y capturar el download
        with page.expect_download(timeout=60_000) as download_info:
            page.get_by_role("button", name="Generar y descargar").click()
        download = download_info.value
        tmp_path = f"/tmp/sprint4-{download.suggested_filename}"
        download.save_as(tmp_path)
        with open(tmp_path, encoding="utf-8") as fh:
            payload = json.load(fh)
        check("5. download JSON ok", bool(payload))
        check("5b. estructura CFDI (emisor/receptor/concepto/totales)",
              all(k in payload for k in ("emisor", "receptor", "concepto",
                                         "totales", "metadata")))
        check("5c. IVA 16% consistente",
              abs(payload["totales"]["subtotal"] * 0.16
                  - payload["totales"]["iva"]) < 0.02
              if payload["totales"]["subtotal"] else False)
        check("5d. emisor placeholder TORA",
              payload["emisor"]["rfc"] == "TDR240101AAA")

        ctx.close()
        browser.close()

    # ── Limpieza verificada ──
    print("[cleanup]")
    def silent_delete(path):
        full = URL + path if path.startswith("/auth/") else REST + path
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    full, headers={"apikey": KEY,
                                   "Authorization": f"Bearer {KEY}"},
                    method="DELETE"),
                timeout=30)
        except Exception as e:
            print(f"    [cleanup] {path.split('?')[0]}: {e}")

    # tickets del E2E (por asunto)
    tickets = api("/support_tickets?subject=eq."
                  + urllib.parse.quote(subject) + "&select=id") or []
    for t in tickets:
        silent_delete("/support_tickets?id=eq." + t["id"])
    # usuario fixture (fila + auth)
    rows = api("/users?email=eq." + urllib.parse.quote(test_email, safe="")
               + "&select=id") or []
    for row in rows:
        silent_delete("/users?id=eq." + row["id"])
    auth_list = urllib.request.Request(
        URL + "/auth/v1/admin/users?per_page=50",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(auth_list, timeout=30) as res:
        users = json.loads(res.read().decode())["users"]
    for u in users:
        if u["email"] == test_email:
            try:
                urllib.request.urlopen(
                    urllib.request.Request(
                        URL + "/auth/v1/admin/users/" + u["id"],
                        headers={"apikey": KEY,
                                 "Authorization": f"Bearer {KEY}"},
                        method="DELETE"),
                    timeout=30)
            except Exception as e:
                print("    [cleanup] auth:", e)

    time.sleep(1)
    residue_t = api("/support_tickets?subject=eq."
                    + urllib.parse.quote(subject) + "&select=id") or []
    residue_u = api("/users?email=eq."
                    + urllib.parse.quote(test_email, safe="")
                    + "&select=id") or []
    check("cleanup: residuo 0", len(residue_t) == 0 and len(residue_u) == 0)

    print(f"\n=== {len(PASS)} PASS / {len(FAIL)} FAIL ===")
    for f in FAIL:
        print("  FAIL:", f)
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
