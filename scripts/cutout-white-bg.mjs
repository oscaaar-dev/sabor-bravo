// Recorta el fondo BLANCO de fotos de platos y las guarda como WebP con transparencia, listas para `npm run assets:dishes`.
// Entrada: recursos_sabor/platos/originales/<plato>.(jpg|jpeg|png)  (los originales NO se modifican)
// Salida:  recursos_sabor/platos/<plato>.webp  (recorte con alfa)
//
// Cómo funciona (sin dependencias nuevas; solo sharp):
//  1. Marca como "fondo" los píxeles casi blancos o grises muy poco saturados (incluye las sombras suaves bajo el plato)
//     que estén CONECTADOS con el borde de la imagen (relleno por inundación). El interior del plato no se toca aunque
//     tenga brillos blancos, porque el aro lo separa del exterior.
//  2. Conserva solo la mayor región resultante: descarta rótulos, marcas de agua o motas sueltas.
//  3. Encoge el borde 1 px y lo suaviza para evitar el halo blanco.
// Uso: npm run assets:cutout            (procesa todas las de originales/)
//      npm run assets:cutout -- postre   (solo una)
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const IN = path.join(root, "recursos_sabor", "platos", "originales");
const OUT = path.join(root, "recursos_sabor", "platos");
const S_MAX = 0.075; // saturación máxima (HSV) de un píxel "de fondo": blanco o gris
const V_MIN = 0.55; // brillo mínimo de un píxel "de fondo" (las sombras suaves son claras)
const ERODE = 1; // píxeles que se encoge el recorte para quitar el halo claro
const only = process.argv[2];

if (!existsSync(IN)) {
  console.error(`No existe ${path.relative(root, IN)}. Guarda ahí las fotos con fondo blanco (nombre = plato, p. ej. postre.jpg).`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const files = readdirSync(IN).filter((f) => /\.(jpe?g|png)$/i.test(f) && (!only || f.startsWith(only)));
if (files.length === 0) console.log("No hay fotos que procesar.");

for (const file of files) {
  const slug = file.replace(/\.[^.]+$/, "");
  const { data, info } = await sharp(path.join(IN, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const n = w * h;

  // 1) píxeles "de fondo" (casi blanco o gris claro, poco saturado)
  const bgLike = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    bgLike[i] = max / 255 >= V_MIN && (max === 0 ? 0 : (max - min) / max) <= S_MAX ? 1 : 0;
  }
  // relleno por inundación desde el borde (4 vecinos)
  const flooded = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (i) => { if (bgLike[i] && !flooded[i]) { flooded[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp > 0) {
    const i = stack[--sp], x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  // 2) primer plano = no inundado; se conserva solo la mayor región conectada
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) fg[i] = flooded[i] ? 0 : 1;
  const label = new Int32Array(n);
  let best = 0, bestSize = 0, next = 1;
  for (let s = 0; s < n; s++) {
    if (!fg[s] || label[s]) continue;
    let size = 0;
    sp = 0;
    stack[sp++] = s;
    label[s] = next;
    while (sp > 0) {
      const i = stack[--sp];
      size++;
      const x = i % w, y = (i - x) / w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) if (j >= 0 && fg[j] && !label[j]) { label[j] = next; stack[sp++] = j; }
    }
    if (size > bestSize) { bestSize = size; best = next; }
    next++;
  }
  let mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = label[i] === best ? 255 : 0;
  const removed = next - 2; // regiones descartadas (rótulos, motas)

  // 3) encoger el borde y suavizarlo
  for (let e = 0; e < ERODE; e++) {
    const out = new Uint8Array(n);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        out[i] = mask[i] && mask[i - 1] && mask[i + 1] && mask[i - w] && mask[i + w] ? 255 : 0;
      }
    mask = out;
  }
  const alpha = await sharp(Buffer.from(mask), { raw: { width: w, height: h, channels: 1 } })
    .blur(0.9)
    .extractChannel(0) // blur puede devolver varios canales: nos quedamos con uno
    .raw()
    .toBuffer();
  if (alpha.length !== n) throw new Error(`alfa con tamaño inesperado: ${alpha.length} ≠ ${n}`);
  const rgba = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = data[i * 3];
    rgba[i * 4 + 1] = data[i * 3 + 1];
    rgba[i * 4 + 2] = data[i * 3 + 2];
    rgba[i * 4 + 3] = alpha[i];
  }
  const dest = path.join(OUT, `${slug}.webp`);
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(dest);
  console.log(`${slug}.webp  ${w}x${h}  plato = ${((bestSize / n) * 100).toFixed(0)}% de la imagen  regiones sueltas descartadas: ${removed}`);
}
