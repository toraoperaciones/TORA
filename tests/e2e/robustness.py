"""
Sprint 5 E2E — robustez: banner offline, error boundary, auto-priorización
de incidentes y orden de la bandeja /ops/incidents.

Ejercicio real contra dev server (puerto 3210) y BD de producción:
  1. Banner offline aparece con set_offline(True) y desaparece al reconectar.
  2. UI de error/not-found del portal CLIENT con botón Reintentar.
  3. Auto-priorización server-side: 4 incidentes vía dialog OPS → severidad
     regla CEO (flight_cancelled=critical, flight_delay>2h=high,
     flight_delay<=2h=medium, billing_issue=low).
  4. Bandeja /ops/incidents ordena critical → high → medium → low.

Fixtures aislados (trip de Acero del Norte + 4 incidents), limpieza verificada
al final (residuo 0). Credenciales leídas de .secrets en runtime — nunca
impresas.
"""

import json
import os
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3210"
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
STAMP = str(int(time.time()))[-7:]
SHOTS = "/tmp/sprint5-robustness"
PASS = FAIL = 0


def check(name, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  PASS {name}")
    else:
        FAIL += 1
        print(f"  FAIL {name} {detail}")


def api(method, path, body=None):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        data=None if body is None else json.dumps(body).encode(),
        method=method,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else []


def load_passwords():
    """El archivo tiene líneas `email password`. No se imprime nunca."""
    out = {}
    with open(".secrets/passwords-20260921.txt") as f:
        for line in f:
            parts = line.strip().split(" ", 1)
            if len(parts) == 2 and "@" in parts[0]:
                out[parts[0]] = parts[1]
    return out


def main():
    os.makedirs(SHOTS, exist_ok=True)
    mark = f"S5 {STAMP}"

    print("== Fixtures ==")
    tenants = api("GET", "tenants?select=id,name&name=ilike.*Acero*&limit=1")
    tenant_id = tenants[0]["id"]
    users = api(
        "GET", f"users?select=id&tenant_id=eq.{tenant_id}&role=eq.CLIENT_ADMIN&limit=1"
    )
    requester_id = users[0]["id"]

    trip = api(
        "POST",
        "trips",
        {
            "tenant_id": tenant_id,
            "requester_id": requester_id,
            "status": "confirmed",
            "origin": "Ciudad de México",
            "destination": f"Monterrey {mark}",
            "departure_date": "2026-12-01",
            "return_date": "2026-12-03",
            "passengers": 1,
            "service_type": "flight",
            "reason": f"Fixture E2E robustez {STAMP}",
            "urgency": "normal",
        },
    )[0]
    trip_id = trip["id"]
    print(f"  trip fixture: {trip_id}")

    kinds = [
        ("flight_cancelled", None),
        ("flight_delay", 3),
        ("flight_delay", 1),
        ("billing_issue", None),
    ]

    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        def new_page():
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            return ctx, ctx.new_page()

        def login(page, email, password):
            page.goto(f"{BASE}/login", wait_until="networkidle")
            page.fill('input[type="email"]', email)
            page.fill('input[type="password"]', password)
            page.click('button[type="submit"]')
            # La sesión tarda en dev (compile + roundtrip): esperar a salir de /login.
            page.wait_for_url(
                lambda url: "/login" not in url, timeout=45_000
            )
            page.wait_for_load_state("networkidle")

        secrets = load_passwords()
        admin_email = "admin@tora.mx"
        client_email = "admin@aceronorte.mx"

        # ── Test 1: banner offline ──
        print("== Test 1: banner offline ==")
        ctx, page = new_page()
        login(page, admin_email, secrets[admin_email])
        ctx.set_offline(True)
        page.wait_for_timeout(700)
        banner = page.locator('[data-testid="offline-banner"]')
        check("banner visible offline", banner.count() > 0 and banner.first.is_visible())
        page.screenshot(path=f"{SHOTS}/03-offline-banner.png")
        ctx.set_offline(False)
        page.wait_for_timeout(700)
        check(
            "banner oculto al reconectar",
            banner.count() == 0 or not banner.first.is_visible(),
        )
        ctx.close()

        # ── Test 3 + 4: auto-priorización y orden de bandeja ──
        print("== Test 3: auto-priorización server-side ==")
        ctx, page = new_page()
        console_errors = []
        page.on(
            "console",
            lambda m: console_errors.append(m.text) if m.type == "error" else None,
        )
        login(page, admin_email, secrets[admin_email])
        page.goto(f"{BASE}/ops/incidents", wait_until="networkidle")

        for kind, hours in kinds:
            page.goto(f"{BASE}/ops/incidents", wait_until="networkidle")
            try:
                page.get_by_role("button", name="Nuevo incidente").click(
                    timeout=15000
                )
            except Exception:
                page.screenshot(path=f"{SHOTS}/99-debug-incidents.png")
                body = page.locator("body").inner_text()
                print("    DEBUG url:", page.url)
                print("    DEBUG body[:600]:", body[:600].replace("\n", " | "))
                print("    DEBUG console:", console_errors[-5:])
                raise
            # Trip
            page.locator('[role="dialog"] button[role="combobox"]').first.click()
            # El fixture tiene destination único (stamp): apuntar a él, no al
            # primer "Monterrey" (que puede ser un trip del seed).
            page.get_by_role("option").filter(has_text=mark).first.click()
            # Tipo
            page.locator('[role="dialog"] button[role="combobox"]').nth(1).click()
            page.get_by_role("option").filter(
                has_text="Vuelo cancelado" if kind == "flight_cancelled"
                else "Retraso de vuelo" if kind == "flight_delay"
                else "facturación"
            ).first.click()
            if kind == "flight_delay":
                page.fill("#incident-delay-hours", str(hours))
            page.fill("#incident-description", f"Incidente de prueba {mark} ({kind}).")
            live = page.locator('[data-severity="live"]')
            print(
                f"    {kind} ({hours or '-'}h) → en vivo: {live.inner_text().strip()}"
            )
            page.get_by_role("button", name="Crear incidente").click()
            page.wait_for_timeout(2500)
            toasts = page.locator("[data-sonner-toast]").all_inner_texts()
            if toasts:
                print("    toasts:", [t[:120] for t in toasts])
            if kind == "flight_cancelled":
                n = api(
                    "GET",
                    f"incidents?select=id&trip_id=eq.{trip_id}",
                )
                print(f"    DEBUG incidents en BD tras 1er intento: {len(n)}")

        rows = api("GET", f"incidents?select=severity&trip_id=eq.{trip_id}")
        got = sorted(r["severity"] for r in rows)
        check(
            "severidades calculadas por el server",
            got == ["critical", "high", "low", "medium"],
            f"got={got}",
        )

        print("== Test 4: orden de bandeja ==")
        page.goto(f"{BASE}/ops/incidents", wait_until="networkidle")
        page.wait_for_timeout(600)
        page.screenshot(path=f"{SHOTS}/04-incidentes-priorizados.png")
        # Filas de nuestros fixtures (descripción contiene el stamp), en el
        # orden en que la bandeja las pinta.
        rows = page.locator("tbody tr").filter(has_text=mark)
        labels = rows.locator("[data-severity-badge]").all_inner_texts()
        rank = {"Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3}
        seq = [rank.get(l.strip(), 9) for l in labels]
        check(
            "bandeja ordenada critical→high→medium→low",
            seq == [0, 1, 2, 3],
            f"labels={labels}",
        )
        ctx.close()

        # ── Test 2: UI de error del portal CLIENT ──
        print("== Test 2: error boundary ==")
        ctx, page = new_page()
        login(page, client_email, secrets[client_email])
        page.goto(
            f"{BASE}/trips/00000000-0000-0000-0000-000000000000",
            wait_until="networkidle",
        )
        body = page.locator("body").inner_text().lower()
        ok_ui = (
            "no existe o cambió de dirección" in body
            or "algo no salió" in body
        ) and "reintentar" in body or "volver al inicio" in body
        check("UI de error/not-found renderizada", ok_ui, page.url)
        page.screenshot(path=f"{SHOTS}/02-error-boundary-client.png")
        ctx.close()

        browser.close()

    # ── Limpieza + residuo 0 ──
    print("== Limpieza ==")
    api("DELETE", f"incidents?trip_id=eq.{trip_id}")
    api("DELETE", f"trips?id=eq.{trip_id}")
    resid_i = api("GET", f"incidents?select=id&trip_id=eq.{trip_id}")
    resid_t = api("GET", f"trips?select=id&id=eq.{trip_id}")
    check("residuo 0", len(resid_i) == 0 and len(resid_t) == 0)

    print(f"\n=== SPRINT 5 ROBUSTNESS: {PASS} PASS · {FAIL} FAIL ===")
    raise SystemExit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
