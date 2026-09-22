"""Flujo D — activación de usuario (pending_approval -> active) con fixture aislado."""
import json, os, sys, time, urllib.request

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3210"
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
STAMP = str(int(time.time()))[-7:]
results = []


def check(name, ok, detail=""):
    results.append((name, ok))
    print(("PASS" if ok else "FAIL") + " — " + name + ((" (" + detail + ")") if detail else ""))


def api(method, path, payload=None):
    req = urllib.request.Request(URL + path,
        data=json.dumps(payload).encode() if payload is not None else None, method=method,
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        b = r.read().decode(); return json.loads(b) if b else None


def user_status(uid):
    rows = api("GET", "/rest/v1/users?id=eq." + uid + "&select=status")
    return rows[0]["status"] if rows else None


PW = {}
with open(".secrets/passwords-20260921.txt") as f:
    for line in f:
        parts = line.strip().split(None, 1)
        if len(parts) == 2: PW[parts[0]] = parts[1]

# Fixture: auth user (trigger -> users.status='pending_approval')
email = "e2e.flowd." + STAMP + "@test-tora.mx"
created = api("POST", "/auth/v1/admin/users", {
    "email": email, "password": "FixtureD2026!x", "email_confirm": True,
    "user_metadata": {"role": "CLIENT_ADMIN", "full_name": "E2E FlowD " + STAMP},
})
uid = created["id"]
check("FIXTURE: usuario creado con estado inicial",
      user_status(uid) is not None, str(user_status(uid)))

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
    page.context.clear_cookies()
    page.goto(BASE + "/login", wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.fill("#email", "admin@tora.mx")
    page.fill("#password", PW["admin@tora.mx"])
    for _ in range(3):
        page.get_by_role("button", name="Ingresar").click()
        for i in range(12):
            page.wait_for_timeout(1000)
            if "/login" not in page.url: break
        if "/login" not in page.url: break
    check("ADMIN: login", "/login" not in page.url)

    page.goto(BASE + "/admin/users?status=pending_approval", wait_until="networkidle")
    page.wait_for_timeout(1500)
    row = page.locator("tr", has_text=STAMP).first
    check("ADMIN: fixture visible entre pendientes", row.count() > 0)

    if row.count() > 0:
        row.get_by_role("button", name="Activar").click()
        page.wait_for_timeout(800)
        triggers = page.locator("div[role='dialog'] button[role='combobox']")
        check("DIALOG: dos selects (rol + tenant)", triggers.count() == 2, str(triggers.count()))
        triggers.nth(1).click()
        page.wait_for_timeout(500)
        page.get_by_role("option", name="Acero del Norte SA de CV").click()
        page.wait_for_timeout(400)
        page.get_by_role("dialog").get_by_role("button", name="Activar").click()
        for i in range(10):
            page.wait_for_timeout(1500)
            if user_status(uid) == "active": break
        check("DIALOG: activación RPC -> active", user_status(uid) == "active", str(user_status(uid)))

        page.goto(BASE + "/admin/users?status=active", wait_until="networkidle")
        page.wait_for_timeout(1500)
        row2 = page.locator("tr", has_text=STAMP).first
        btn = row2.get_by_role("button", name="Suspender")
        check("ADMIN: botón Suspender presente", btn.count() > 0)
        if btn.count() > 0:
            btn.click()
            page.wait_for_timeout(2500)
            check("ADMIN: toggle suspende en BD", user_status(uid) == "suspended", str(user_status(uid)))
    b.close()

# Limpieza
api("DELETE", "/auth/v1/admin/users/" + uid)
res = api("GET", "/rest/v1/users?id=eq." + uid + "&select=id")
check("Limpieza: residuo = 0", len(res) == 0)

failed = [n for n, ok in results if not ok]
print("")
print(str(len(results) - len(failed)) + "/" + str(len(results)) + " checks PASS")
if failed: print("FALLOS: " + "; ".join(failed))
sys.exit(1 if failed else 0)
