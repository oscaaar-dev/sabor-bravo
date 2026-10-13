// Deriva el fondo del hero a partir del fondo oficial: deja SOLO el logo y su pincelada (arriba a la
// izquierda) y la marca de agua "SABOR", y rellena el resto con papel limpio del propio fondo.
// Quita lo que añadía ruido: lemas, líneas de impacto, óvalo naranja, esquina roja y marca "BRAVO".
// El original de recursos_sabor/ NO se modifica. Uso: npm run assets:hero
import sharp from "sharp";
import path from "node:path";

const root = process.cwd();
const SRC = path.join(root, "recursos_sabor", "Fondo retro de Sabor Bravo.png");
const OUT = path.join(root, "public", "images", "hero", "fondo-hero.png");
const { width: W, height: H } = await sharp(SRC).metadata();

// Color medio del papel, medido en una zona limpia (247,233,206; desviación ≈ 1–2 sobre 255, es decir
// prácticamente plano). Un relleno liso evita las costuras que deja repetir un parche.
const PAPER = { r: 247, g: 233, b: 206 };

// Zonas a limpiar (coordenadas del original 1672x941):
//  - todo lo que está a la derecha de x=740 (marca "BRAVO", lema, óvalo naranja, esquina roja)
//  - la franja inferior izquierda desde y=650 (lema "El sabor de lo nuestro" y sus líneas)
const rects = [
  { left: 740, top: 0, width: W - 740, height: H },
  { left: 0, top: 650, width: 740, height: H - 650 },
];

const layers = [];
for (const r of rects) {
  const tile = await sharp({ create: { width: r.width, height: r.height, channels: 3, background: PAPER } })
    .png()
    .toBuffer();
  layers.push({ input: tile, left: r.left, top: r.top });
}

await sharp(SRC).composite(layers).png({ compressionLevel: 9 }).toFile(OUT);
const m = await sharp(OUT).metadata();
console.log(`fondo-hero.png ${m.width}x${m.height} generado`);

// Lema oficial "Buena comida, mejores momentos." recortado del fondo original como recurso aparte.
// Se coloca con HTML, anclado a la composición de platos, para que nunca dependa del encuadre del fondo.
// El papel de alrededor se hace TRANSPARENTE (clave por distancia de color al papel de la esquina),
// para que no quede un rectángulo de otro tono sobre el fondo.
const LEMA = path.join(root, "public", "images", "hero", "lema-buena-comida.png");
const crop = await sharp(SRC).extract({ left: 1380, top: 30, width: 280, height: 150 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { data, info } = crop;
const pr = data[0], pg = data[1], pb = data[2]; // papel en la esquina superior izquierda del recorte
for (let i = 0; i < info.width * info.height; i++) {
  const o = i * 4;
  const d = Math.max(Math.abs(data[o] - pr), Math.abs(data[o + 1] - pg), Math.abs(data[o + 2] - pb));
  data[o + 3] = Math.max(0, Math.min(255, Math.round(((d - 10) * 255) / 40)));
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(LEMA);
console.log("lema-buena-comida.png 280x150 (fondo transparente) generado");
