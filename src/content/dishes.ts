/**
 * Manifiesto de fotografías gastronómicas.
 * Cada entrada apunta a un PNG que DEBE colocarse en public/images/dishes/.
 * `DishPhoto` comprueba en el servidor si el archivo existe; si no, muestra una
 * reserva claramente marcada. Nunca se asume que un archivo existe.
 */
export type DishSlug =
  | "ceviche"
  | "pollo-brasa"
  | "lomo-saltado"
  | "chicha-morada"
  | "arroz-chaufa"
  | "pizza"
  | "cafe"
  | "postre";

export interface DishAsset {
  readonly label: string;
  readonly file: string;
  /** Especialidad de negocio que ilustra (sección de demostraciones). */
  readonly especialidad: string;
}

export const DISHES: Readonly<Record<DishSlug, DishAsset>> = {
  ceviche: { label: "Ceviche peruano", file: "/images/dishes/ceviche.png", especialidad: "Cevichería" },
  "pollo-brasa": { label: "Pollo a la brasa", file: "/images/dishes/pollo-brasa.png", especialidad: "Pollería" },
  "lomo-saltado": { label: "Lomo saltado", file: "/images/dishes/lomo-saltado.png", especialidad: "Comida criolla" },
  "chicha-morada": { label: "Chicha morada", file: "/images/dishes/chicha-morada.png", especialidad: "Bebidas" },
  "arroz-chaufa": { label: "Arroz chaufa", file: "/images/dishes/arroz-chaufa.png", especialidad: "Chifa" },
  pizza: { label: "Pizza artesanal", file: "/images/dishes/pizza.png", especialidad: "Pizzería" },
  cafe: { label: "Café", file: "/images/dishes/cafe.png", especialidad: "Cafetería" },
  postre: { label: "Postre", file: "/images/dishes/postre.png", especialidad: "Pastelería" },
};
