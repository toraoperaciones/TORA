"use client";

/**
 * Sparkline TORA — SVG inline 60×24, stroke 1.5. Sin ejes, sin grid.
 * `tone="money"` usa forest (solo métricas de dinero); el resto navy.
 */

interface SparklineProps {
  points: number[];
  tone?: "navy" | "money";
  className?: string;
}

export function Sparkline({ points, tone = "navy", className }: SparklineProps) {
  const W = 60;
  const H = 24;
  const PAD = 2;

  if (points.length < 2) {
    return (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className={className}
        aria-hidden
      >
        <line
          x1={PAD}
          y1={H / 2}
          x2={W - PAD}
          y2={H / 2}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const step = (W - PAD * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = PAD + i * step;
    const y = H - PAD - ((p - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const stroke = tone === "money" ? "var(--color-forest)" : "currentColor";

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      aria-hidden
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeOpacity={tone === "money" ? 1 : 0.55}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
