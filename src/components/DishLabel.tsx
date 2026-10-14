interface DishLabelProps {
  children: React.ReactNode;
  /** Posición dentro de la composición (clases `left-[..%] top-[..%]`). */
  className?: string;
}

/**
 * Etiqueta de pincel con el nombre del plato. Coral (--color-coral) con texto tinta: 5,9:1, cumple AA
 * con cualquier tamaño. El tamaño del texto escala con el ancho de la composición (unidades `cqw`).
 */
export function DishLabel({ children, className = "" }: DishLabelProps) {
  return (
    <span data-kind="label" className={`absolute inline-block -rotate-[7deg] ${className}`}>
      <svg
        viewBox="0 0 300 80"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M6 16 L44 7 L118 12 L206 5 L293 13 L284 31 L297 45 L283 61 L202 71 L112 67 L32 75 L9 63 L17 45 L4 29 Z"
          fill="var(--color-coral)"
        />
      </svg>
      <span className="h-script relative block whitespace-nowrap px-[1.15em] py-[0.32em] text-[max(0.72rem,3.1cqw)] leading-none text-tinta">
        {children}
      </span>
    </span>
  );
}
