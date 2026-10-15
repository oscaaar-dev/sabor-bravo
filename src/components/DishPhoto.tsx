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
  shape?: "circle" | "tile";
}

function publicFileExists(publicUrl: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", publicUrl));
}

/** ¿Existe ya la foto de este plato en public/? (solo servidor). */
export function hasDishPhoto(slug: DishSlug): boolean {
  return publicFileExists(DISHES[slug].file);
}

/**
 * Foto de plato en marco circular (aro tinta + aro blanco cálido) que rellena a su contenedor.
 * La foto es CUADRADA y se recorta en círculo (`object-cover`); no necesita fondo transparente.
 * Si el PNG todavía no existe (ver docs/ASSETS.md), dibuja una reserva con la misma forma.
 */
export function DishPhoto({ slug, sizes, priority = false, className = "", shape = "circle" }: DishPhotoProps) {
  const dish = DISHES[slug];
  const hasPhoto = publicFileExists(dish.file);
  const tile = shape === "tile";

  return (
    <div
      role={hasPhoto ? undefined : "img"}
      aria-label={hasPhoto ? undefined : `${dish.label} (foto pendiente)`}
      className={`@container absolute inset-0 ${tile ? "rounded-lg" : "rounded-full bg-tinta p-[2.4%]"} ${className}`}
    >
      <div className={`h-full w-full ${tile ? "" : "rounded-full bg-blanco p-[2.8%]"}`}>
        <div className={`relative h-full w-full overflow-hidden bg-arena ${tile ? "rounded-lg" : "rounded-full"}`}>
          {hasPhoto ? (
            <Image src={dish.file} alt={dish.label} fill sizes={sizes} priority={priority} className="object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <p className="hidden text-center text-[0.62rem] font-bold uppercase leading-tight tracking-wider text-tinta-suave @[7rem]:block">
                Foto
                <br />
                pendiente
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
