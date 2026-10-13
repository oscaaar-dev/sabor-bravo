// Deriva los recursos de marca a partir de los PNG originales de /recursos_sabor.
// Los originales NO se modifican. Salida: public/images/{brands,hero}/ y src/app/icon.png
// Uso: npm run assets:brand
import sharp from "sharp";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const SRC_LOGO = path.join(root, "recursos_sabor", "Logo de Llama Sabor Bravo.png");
const SRC_BG = path.join(root, "recursos_sabor", "Fondo retro de Sabor Bravo.png");
const OUT_BRANDS = path.join(root, "public", "images", "brands");
const OUT_HERO = path.join(root, "public", "images", "hero");

await mkdir(OUT_BRANDS, { recursive: true });
await mkdir(OUT_HERO, { recursive: true });

// Medidas sobre el lienzo original 1536x1024 (comprobadas sobre fondo crema):
//  - llama:     x 225–545, y 245–740
//  - wordmark:  x 535–1300, y 235–750
//  - subrayado: x 600–1250, y 655–795 (trazo rojo)
const { data, info } = await sharp(SRC_LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

/** Copia el logo aplicando `keep(x, y, r, g, b, a)` y devuelve un PNG recortado al contenido. */
async function cut(name, keep, size) {
  const buf = Buffer.from(data);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!keep(x, y, buf[i], buf[i + 1], buf[i + 2], buf[i + 3])) buf[i + 3] = 0;
    }
  }
  let img = sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 30 });
  if (size?.height) img = img.resize({ height: size.height, withoutEnlargement: true });
  if (size?.square) {
    img = img.resize(size.square, size.square, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  const out = path.join(OUT_BRANDS, name);
  await img.png({ compressionLevel: 9 }).toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`${name}: ${meta.width}x${meta.height}`);
  return out;
}

const isRed = (r, g, b) => r > 150 && g < 120 && b < 110;
const isDark = (r, g, b) => r < 110 && g < 110 && b < 110;

// Horizontal: llama + wordmark + subrayado (composición original).
await cut("sabor-bravo-horizontal.png", () => true, { height: 480 });

// Compacta: llama + wordmark, sin el subrayado rojo (zona y>650 a la derecha de la llama).
await cut(
  "sabor-bravo-compacto.png",
  (x, y, r, g, b) => !(x > 560 && y > 650 && isRed(r, g, b)),
  { height: 400 },
);

// Icono: solo la llama (rojo a la izquierda del wordmark; descarta el trazo negro que la roza).
const icon = await cut(
  "sabor-bravo-icono.png",
  (x, y, r, g, b) => x < 560 && !isDark(r, g, b),
  { square: 512 },
);

// Favicon de la app (Next.js lo toma de src/app/icon.png)
await sharp(icon).resize(256, 256).png({ compressionLevel: 9 }).toFile(path.join(root, "src", "app", "icon.png"));

// Fondo oficial: se copia tal cual (PNG). next/image lo sirve optimizado por dispositivo.
await copyFile(SRC_BG, path.join(OUT_HERO, "fondo-sabor-bravo.png"));
console.log("fondo-sabor-bravo.png copiado (1672x941)");
