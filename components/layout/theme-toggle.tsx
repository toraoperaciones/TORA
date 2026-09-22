"use client";

import { RiMoonLine, RiSunLine } from "@remixicon/react";
import { useEffect, useState } from "react";

/**
 * Theme toggle TORA — dark es el default; light es la excepción.
 * Persistido en localStorage (script anti-flash en app/layout.tsx).
 * Mecanismo: clase .dark en <html> (estándar del preset shadcn).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [isLight, setIsLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsLight(!document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    try {
      if (next) {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("tora-theme", "light");
      } else {
        document.documentElement.classList.add("dark");
        localStorage.setItem("tora-theme", "dark");
      }
    } catch {
      // localStorage no disponible: el toggle funciona solo en esta vista
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      className={
        className ??
        "flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
      }
    >
      {mounted && isLight ? (
        <RiMoonLine className="h-4 w-4" aria-hidden />
      ) : (
        <RiSunLine className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
