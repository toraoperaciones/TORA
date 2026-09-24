"""
Fase 1 — Auditoría TORA: sweep de rutas por rol con Playwright (headless).

Por ruta mide: tiempo de carga (ms), console errors/warnings, botones sin
aria-label, badges sin texto, imagenes sin alt, headings. Captura screenshot
por ruta en /tmp/tora-audit/shots/ y escribe /tmp/tora-audit/sweep.json.

Solo lectura: no crea ni modifica datos.
"""
import json
import os
import re
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3210"
OUT = Path("/tmp/tora-audit")
SHOTS = OUT / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)

URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

SECRETS = Path(".secrets/passwords-20260921.txt")
CREDS = {}
for line in SECRETS.read_text().splitlines():
    line = line.strip()
    if not line or " " not in line:
        continue
    email, pw = line.split(None, 1)
    CREDS[email] = pw


def save_pw(email: str, new_pw: str) -> None:
    """Persiste rotaciones en .secrets (mismo patrón que los E2E)."""
    lines = SECRETS.read_text().splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith(email + " "):
            lines[i] = f"{email} {new_pw}"
    SECRETS.write_text("\n".join(lines) + "\n")

ROUTES = {
    "admin@tora.mx": [
        "/dashboard", "/trips", "/wallet", "/invoices",
        "/admin", "/admin/tenants", "/admin/users", "/admin/pipeline",
        "/admin/invoices", "/admin/issuers",
        "/ops/inbox", "/ops/incidents",
        "/finance/dashboard", "/finance/deposits", "/finance/credit",
        "/finance/invoices",
        "/perfil", "/soporte",
    ],
    "ops@tora.mx": [
        "/ops/inbox", "/ops/trips", "/ops/incidents", "/ops/clients",
        "/perfil", "/soporte",
    ],
    "finanzas@tora.mx": [
        "/finance/dashboard", "/finance/deposits", "/finance/credit",
        "/finance/invoices", "/perfil", "/soporte",
    ],
    "admin@aceronorte.mx": [
        "/dashboard", "/trips", "/wallet", "/invoices", "/perfil", "/soporte",
    ],
    "finanzas@vcm.mx": [
        "/dashboard", "/trips", "/invoices", "/perfil", "/soporte",
    ],
}

PUBLIC_ROUTES = ["/", "/login", "/aviso-privacidad", "/terminos"]


def rest(path: str):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", headers={
        "apikey": KEY, "Authorization": f"Bearer {KEY}",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def auth_login(page, email: str, pw: str) -> bool:
    """Patron probado del repo (whatsapp-notify.py): selectores estables,
    espera de hidratacion y reintentos."""
    page.context.clear_cookies()
    page.goto(f"{BASE}/login", wait_until="networkidle", timeout=90_000)
    email_input = page.locator('input[type="email"]')
    pw_input = page.locator('input[type="password"]')
    submit = page.locator('button[type="submit"]')
    email_input.wait_for(state="visible", timeout=60_000)
    for attempt in range(4):
        email_input.fill(email)
        pw_input.fill(pw)
        try:
            submit.click(timeout=5_000)
        except Exception:
            page.wait_for_timeout(1500)
            continue
        for _i in range(15):
            page.wait_for_timeout(1000)
            if "/login" not in page.url:
                # Gate de cambio de password: rotar y persistir (igual que E2E).
                if "/cambiar-password" in page.url:
                    new_pw = "S1" + pw + "!x"
                    page.fill("#current-password", pw)
                    page.fill("#new-password", new_pw)
                    page.fill("#confirm-password", new_pw)
                    page.get_by_role("button", name="Guardar contrasena").or_(
                        page.get_by_role("button", name="Guardar contraseña")).first.click()
                    page.wait_for_timeout(1800)
                    CREDS[email] = new_pw
                    save_pw(email, new_pw)
                    page.goto(f"{BASE}/", wait_until="domcontentloaded", timeout=90_000)
                return True
    return False


def sweep_route(page, email: str, route: str, idx: int):
    t0 = time.time()
    errors, warnings, reqfail = [], [], []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error"
            else (warnings.append(m.text) if m.type == "warning" else None))
    page.on("response", lambda r: reqfail.append(f"{r.status} {r.url[-60:]}")
            if r.status >= 400 else None)
    page.goto(f"{BASE}{route}", wait_until="networkidle", timeout=90000)
    load_ms = int((time.time() - t0) * 1000)
    page.wait_for_timeout(400)

    audit_btns = page.evaluate("""() => {
      const out = [];
      for (const b of document.querySelectorAll('button, [role="button"], a.button, a[class*="btn"]')) {
        const t = (b.innerText || '').trim();
        const aria = b.getAttribute('aria-label');
        if (!t && !aria) out.push({tag: b.tagName, cls: (b.className||'').toString().slice(0,60)});
      }
      return out.slice(0, 10);
    }""")
    badges = page.evaluate("""() => {
      const out = [];
      for (const b of document.querySelectorAll('[class*="badge" i], [class*="Badge"]')) {
        const t = (b.textContent || '').trim();
        if (!t) out.push({cls: (b.className||'').toString().slice(0,60)});
      }
      return out.length;
    }""")
    imgs_no_alt = page.evaluate(
        "() => [...document.querySelectorAll('img:not([alt])')].length")
    headings = page.evaluate(
        "() => [...document.querySelectorAll('h1,h2')].slice(0,4).map(h => h.textContent.trim().slice(0,60))")
    body_chars = page.evaluate("() => (document.body.innerText||'').length")

    slug = re.sub(r"[^a-z0-9]+", "-", f"{email.split('@')[0]}{route}").strip("-")[:48]
    shot = SHOTS / f"{idx:02d}-{slug}.png"
    try:
        page.screenshot(path=str(shot), full_page=False)
    except Exception:
        shot = None

    return {
        "email": email, "route": route, "load_ms": load_ms,
        "console_errors": errors[:8], "console_warnings": warnings[:5],
        "http_4xx_5xx": reqfail[:6],
        "buttons_no_label": audit_btns, "empty_badges": badges,
        "imgs_no_alt": imgs_no_alt, "headings": headings,
        "body_chars": body_chars, "shot": str(shot) if shot else None,
    }


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        for route in PUBLIC_ROUTES:
            results.append(sweep_route(page, "public", route, len(results)))

        for email, routes in ROUTES.items():
            pw = CREDS.get(email)
            if not pw:
                results.append({"email": email, "route": "-", "error": "sin credencial"})
                continue
            if not auth_login(page, email, pw):
                results.append({"email": email, "route": "-", "error": "login fallo"})
                continue
            for route in routes:
                try:
                    results.append(sweep_route(page, email, route, len(results)))
                except Exception as e:
                    results.append({"email": email, "route": route,
                                    "error": str(e)[:180]})
        browser.close()

    (OUT / "sweep.json").write_text(json.dumps(results, indent=1, ensure_ascii=False))
    print(f"rutas auditadas: {len(results)}")
    for r in results:
        if "error" in r:
            print(f"  ERR {r['email']} {r.get('route','-')}: {r['error'][:90]}")
        else:
            print(f"  {r['load_ms']:>6}ms {r['email']:<22} {r['route']:<22} "
                  f"err={len(r['console_errors'])} btns_sin_label={len(r['buttons_no_label'])} "
                  f"badges_vacios={r['empty_badges']} img={r['imgs_no_alt']}")


if __name__ == "__main__":
    main()
