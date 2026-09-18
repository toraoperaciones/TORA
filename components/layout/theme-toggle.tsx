"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Theme toggle TORA — dark es el default; light es la excepción.
 * Persistido en localStorage (script anti-flash en app/layout.tsx).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [isLight, setIsLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsLight(document.documentElement.dataset.theme === "light");
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    try {
      if (next) {
        document.documentElement.dataset.theme = "light";
        localStorage.setItem("tora-theme", "light");
      } else {
        delete document.documentElement.dataset.theme;
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
        "flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 hover:bg-layer-2 hover:text-text-primary"
      }
    >
      {mounted && isLight ? (
        <Moon className="h-4 w-4" aria-hidden />
      ) : (
        <Sun className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
