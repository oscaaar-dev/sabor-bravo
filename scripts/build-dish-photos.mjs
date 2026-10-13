// Prepara las fotos de platos para los marcos circulares. Entrada: recursos_sabor/platos/<slug>.webp
// (recortes con fondo transparente; los originales NO se modifican). Salida: public/images/dishes/<slug>.png,
// cuadrado de 1400×1400 con el plato centrado y su punto más lejano a ~94 % del radio del círculo, de modo
// que el recorte circular (object-cover) nunca corta el plato. Uso: npm run assets:dishes
import sharp from "sharp";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const IN = path.join(root, "recursos_sabor", "platos");
const OUT = path.join(root, "public", "images", "dishes");
const SIZE = 1400;
const FILL = 0.94; // fracción del radio del círculo que ocupa el punto más lejano del plato
const ALPHA_MIN = 40; // píxeles con alfa menor se ignoran (bordes difuminados)
mkdirSync(OUT, { recursive: true });

for (const file of readdirSync(IN).filter((f) => f.endsWith(".webp"))) {
  const slug = file.replace(/\.webp$/, "");
  const { data, info } = await sharp(path.join(IN, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  // 1) caja del plato según el canal alfa
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > ALPHA_MIN) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // 2) radio que necesita el círculo: distancia al píxel opaco más lejano del centro
  let far = 0;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++)
      if (data[(y * w + x) * 4 + 3] > ALPHA_MIN) far = Math.max(far, Math.hypot(x - cx, y - cy));
  const side = Math.round((2 * far) / FILL); // lado del cuadrado de recorte en píxeles de origen

  // 3) lienzo transparente de `side`×`side` con el plato centrado, escalado a 1400
  const left = Math.round(cx - side / 2);
  const top = Math.round(cy - side / 2);
  const canvas = sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const src = await sharp(path.join(IN, file)).ensureAlpha().png().toBuffer();
  const ox = Math.max(0, -left), oy = Math.max(0, -top); // desplazamiento en el lienzo
  const sx = Math.max(0, left), sy = Math.max(0, top); // origen del recorte en la imagen
  const cw = Math.min(w - sx, side - ox), ch = Math.min(h - sy, side - oy);
  const piece = await sharp(src).extract({ left: sx, top: sy, width: cw, height: ch }).png().toBuffer();
  // sharp aplica resize ANTES que composite: se compone primero a tamaño de origen y se escala después.
  const composed = await canvas.composite([{ input: piece, left: ox, top: oy }]).png().toBuffer();
  await sharp(composed).resize(SIZE, SIZE).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${slug}.png`));
  console.log(`${slug}.png  origen ${w}x${h}  plato x ${minX}-${maxX} y ${minY}-${maxY}  lado de recorte ${side}px -> ${SIZE}x${SIZE}`);
}
