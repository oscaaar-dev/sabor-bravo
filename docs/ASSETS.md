# Recursos gráficos de Sabor Bravo

## Ya disponibles (derivados de `recursos_sabor/`)

Se generan con `npm run assets:brand`. Los originales de `recursos_sabor/` no se modifican.

| Archivo | Uso |
|---|---|
| `public/images/brands/sabor-bravo-horizontal.png` | Logo completo (llama + palabra + subrayado), fondo transparente |
| `public/images/brands/sabor-bravo-compacto.png` | Llama + palabra, sin subrayado. Barra de navegación |
| `public/images/brands/sabor-bravo-icono.png` | Solo la llama, 512×512, transparente |
| `src/app/icon.png` | Favicon (256×256, desde el icono) |
| `public/images/hero/fondo-sabor-bravo.png` | Fondo oficial completo (1672×941). Ya no se usa en el hero; se conserva |
| `public/images/hero/fondo-hero.png` | Fondo del hero: solo logo, pincelada y marca de agua (derivado, `npm run assets:hero`) |
| `public/images/hero/lema-buena-comida.png` | Lema oficial recortado, fondo transparente (derivado, `npm run assets:hero`) |

Nota: la palabra "SABOR BRAVO" del logo es **negra**; sobre fondos oscuros hay que ponerla sobre un parche crema.

## Pendientes: fotografías de platos

**Entregadas (3 de 8):** `ceviche`, `pollo-brasa` y `lomo-saltado`. Los originales (recortes con fondo transparente) están en
`recursos_sabor/platos/*.webp` y NO se modifican; `npm run assets:dishes` genera `public/images/dishes/<plato>.png`
(1400×1400, ampliado para que el plato llene todo el círculo; los extremos de platos ovalados quedan recortados). Para cambiar una foto: reemplazar el original y volver a ejecutar el script.

**Pendientes:** `cafe`, `chicha-morada`, `arroz-chaufa`, `pizza` y `postre`. Mientras falten, `DishPhoto` dibuja una reserva circular con la etiqueta "Foto pendiente".
Para añadirlas: guardar el recorte como `recursos_sabor/platos/<plato>.webp` y ejecutar `npm run assets:dishes` (se detecta solo, sin tocar código).

Especificaciones comunes:

- **Cualquier proporción de origen**: el script la convierte a un cuadrado de 1400×1400 px y se muestra recortada en **círculo** con aro carbón y aro crema. Un recorte con **fondo transparente** (como los entregados) queda sobre el papel crema del círculo; una foto con fondo también funciona.
- Plato completo y sin cortes en la foto original; el script lo centra y lo amplía hasta que ocupe todo el círculo (radio = 97 % del mayor círculo inscrito en la silueta), sin dejar huecos de fondo.
- Vista cenital o 3/4, iluminación de campaña publicitaria, sin texto ni logos dentro de la foto (el nombre del plato lo pone la interfaz en una etiqueta de pincel).
- La bebida (`chicha-morada.png`) usa el mismo formato cuadrado.

| Archivo en `public/images/dishes/` | Plato | Dónde se usa |
|---|---|---|
| `ceviche.png` | Ceviche peruano (con choclo y camote) | Hero (arriba a la derecha), demo La Mar Cevichería |
| `pollo-brasa.png` | Pollo a la brasa con papas | Hero (plato principal), demo El Gallo Bravo |
| `lomo-saltado.png` | Lomo saltado | Hero (abajo a la izquierda), demo Sabor Criollo |
| `chicha-morada.png` | Vaso de chicha morada | Reservado |
| `cafe.png` | Café / bebida caliente | Demo Café del Valle |
| `arroz-chaufa.png` | Arroz chaufa | Reservado (chifa) |
| `pizza.png` | Pizza | Reservado (pizzería) |
| `postre.png` | Postre / pastelería | Reservado (pastelería) |

El manifiesto con estos nombres es `src/content/dishes.ts`.

## Carpetas

- `public/images/hero/` — fondos y composiciones del hero.
- `public/images/dishes/` — fotografías de platos (tabla anterior).
- `public/images/brands/` — logotipos.
- `public/images/illustrations/` — ilustraciones/trazos adicionales (vacía por ahora).
