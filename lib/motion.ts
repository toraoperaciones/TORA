/** Variantes de motion compartidas (motion/react). Disciplina: 100–300ms, out-expo. */
import type { Transition, Variants } from "motion/react";

export const EASE_TORA: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const transitionFast: Transition = { duration: 0.15, ease: EASE_TORA };
export const transitionBase: Transition = { duration: 0.2, ease: EASE_TORA };

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitionBase },
};

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: transitionBase },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: transitionBase },
};

export const hoverLift = { y: -2, transition: { duration: 0.15 } } as const;
