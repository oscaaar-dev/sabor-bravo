/**
 * Gráficos de marca en SVG. Todo se genera con un PRNG con semilla fija,
 * así el servidor y el cliente producen exactamente el mismo trazo.
 */

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

/** Mancha de pincel irregular (cerrada), pensada para ir detrás de los platos. */
function blobPath(seed: number): string {
  const r = rng(seed);
  const pts: string[] = [];
  const n = 46;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // elipse ancha con bordes rotos: algunos puntos salen como cerdas de pincel
    const spike = r() > 0.82 ? 1.1 + r() * 0.12 : 0.9 + r() * 0.1;
    const x = 500 + Math.cos(a) * 470 * spike;
    const y = 400 + Math.sin(a) * 340 * spike;
    pts.push(`${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`);
  }
  return `${pts.join(" ")}Z`;
}

const BLOB_A = blobPath(11);
const BLOB_B = blobPath(37);

export function BrushSplash({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 800"
      aria-hidden="true"
      focusable="false"
      className={className}
      preserveAspectRatio="none"
    >
      <path d={BLOB_B} fill="var(--color-coral-claro)" transform="translate(40 30) rotate(-5 500 400)" />
      <path d={BLOB_A} fill="var(--color-coral)" transform="translate(-10 0) rotate(4 500 400)" />
    </svg>
  );
}

/** Borde rasgado de papel: relleno `fill` abajo y filo irregular arriba. */
function tornPoints(seed: number): string {
  const r = rng(seed);
  const pts: string[] = ["0,100"];
  let x = 0;
  while (x < 1200) {
    const y = 14 + r() * 56;
    pts.push(`${x},${f(y)}`);
    x += 14 + r() * 30;
  }
  pts.push("1200,40", "1200,100");
  return pts.join(" ");
}
const TORN_TOP = tornPoints(5);

export function TornEdge({ fill = "var(--color-petroleo)", className = "" }: { fill?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <polygon points={TORN_TOP} fill={fill} />
    </svg>
  );
}

/** Líneas de impacto dibujadas a mano, como las del fondo oficial. */
export function Burst({ className = "", stroke = "var(--color-tinta)" }: { className?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 120 100" aria-hidden="true" focusable="false" className={className} fill="none">
      <g stroke={stroke} strokeWidth="6" strokeLinecap="round">
        <path d="M8 62 L44 74" />
        <path d="M26 28 L56 52" />
        <path d="M64 6 L74 44" />
        <path d="M104 14 L92 40" />
      </g>
    </svg>
  );
}

/** Flecha curva dibujada a mano que acompaña a las anotaciones en Lobster. */
export function HandArrow({ className = "", stroke = "var(--color-tinta)" }: { className?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 90 90" aria-hidden="true" focusable="false" className={className} fill="none">
      <path
        d="M8 10 C 52 6, 80 30, 62 70"
        stroke={stroke}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M46 62 L62 72 L72 54" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Subrayado de pincel para titulares. Por defecto coral; sobre fondo coral pasar `fill="var(--color-petroleo)"`. */
export function BrushUnderline({ className = "", fill = "var(--color-coral)" }: { className?: string; fill?: string }) {
  return (
    <svg
      viewBox="0 0 400 28"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M4 20 C 90 8, 200 6, 396 12 C 250 14, 120 18, 20 24 Z"
        fill={fill}
      />
    </svg>
  );
}
