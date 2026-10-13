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

Todavía **no existen**. Mientras falten, `DishPhoto` dibuja una reserva con la ruta esperada (solo fuera de producción).
Basta con guardar el PNG con el nombre exacto: se detecta solo, sin tocar código.

Especificaciones comunes:

- **Foto CUADRADA, 1400×1400 px, PNG.** Se muestra recortada en **círculo** con aro carbón y aro crema (`object-cover`): **no necesita fondo transparente**.
- Plato centrado y completo, con ~6 % de margen respecto al círculo (el recorte circular corta las esquinas).
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
