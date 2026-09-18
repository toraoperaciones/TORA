"use client";

import { motion } from "motion/react";

import { EASE_TORA } from "@/lib/motion";

/**
 * Checkmark animado — confirmación de dinero. SVG path draw de 500ms,
 * propósito único: decir "sí, tu acción de dinero tuvo efecto".
 * Aparece solo en el momento del éxito (frequency-gated por naturaleza).
 */
export function AnimatedCheck({ className }: { className?: string }) {
  return (
    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center text-primary">
      <svg
        viewBox="0 0 20 20"
        className={className}
        role="img"
        aria-label="Confirmado"
        fill="none"
      >
        <motion.circle
          cx="10"
          cy="10"
          r="9"
          stroke="currentColor"
          strokeWidth="1.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3, ease: EASE_TORA }}
        />
        <motion.path
          d="M6 10.5l2.6 2.5L14 7.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.25, delay: 0.25, ease: EASE_TORA }}
        />
      </svg>
    </span>
  );
}
