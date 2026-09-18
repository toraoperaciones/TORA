"use client";

import { motion } from "motion/react";

import { EASE_TORA } from "@/lib/motion";

/**
 * Wrappers de stagger (40ms entre items). Los Server Components pueden
 * envolver contenido en <Stagger>/<StaggerItem> sin volverse client:
 * este módulo es el único punto client del patrón.
 */
export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      variants={{ animate: { transition: { staggerChildren: 0.04 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_TORA } },
      }}
    >
      {children}
    </motion.div>
  );
}
