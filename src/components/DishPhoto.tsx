import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { DISHES, type DishSlug } from "@/content/dishes";

interface DishPhotoProps {
  slug: DishSlug;
  /** Valor de `sizes` para next/image (el contenedor padre define el tamaño real). */
  sizes: string;
  priority?: boolean;
  className?: string;
}

function publicFileExists(publicUrl: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", publicUrl));
}

/**
 * Foto de plato recortada (PNG con fondo transparente) que rellena a su contenedor.
 * Si el PNG no existe todavía, dibuja una reserva con la forma de un plato y el
 * nombre del archivo esperado (solo visible fuera de producción).
 */
export function DishPhoto({ slug, sizes, priority = false, className = "" }: DishPhotoProps) {
  const dish = DISHES[slug];

  if (publicFileExists(dish.file)) {
    return (
      <Image
        src={dish.file}
        alt={dish.label}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-contain drop-shadow-[0_14px_0_rgba(23,20,18,0.18)] ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${dish.label} (foto pendiente)`}
      className={`@container absolute inset-0 grid place-items-center ${className}`}
    >
      <div className="relative grid aspect-square w-full max-w-full place-items-center rounded-full border-[3px] border-carbon bg-crema shadow-brutal-sm">
        <div className="absolute inset-[9%] rounded-full border-2 border-dashed border-carbon/50" />
        <div className="relative px-[14%] text-center">
          <p className="h-script text-[clamp(1rem,2.4vw,1.7rem)] text-rojo-oscuro">{dish.label}</p>
          <p className="mt-1 hidden text-[0.6rem] font-bold uppercase leading-tight tracking-wider text-carbon-suave @[11rem]:block">
            Foto pendiente
          </p>
        </div>
      </div>
    </div>
  );
}
