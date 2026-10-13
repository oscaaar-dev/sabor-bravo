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
