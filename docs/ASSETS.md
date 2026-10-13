# Recursos gráficos de Sabor Bravo

## Ya disponibles (derivados de `recursos_sabor/`)

Se generan con `npm run assets:brand`. Los originales de `recursos_sabor/` no se modifican.

| Archivo | Uso |
|---|---|
| `public/images/brands/sabor-bravo-horizontal.png` | Logo completo (llama + palabra + subrayado), fondo transparente |
| `public/images/brands/sabor-bravo-compacto.png` | Llama + palabra, sin subrayado. Barra de navegación |
| `public/images/brands/sabor-bravo-icono.png` | Solo la llama, 512×512, transparente |
| `src/app/icon.png` | Favicon (256×256, desde el icono) |
| `public/images/hero/fondo-sabor-bravo.png` | Fondo oficial del hero (1672×941). Ya lleva impresos el logo y dos lemas |

Nota: la palabra "SABOR BRAVO" del logo es **negra**; sobre fondos oscuros hay que ponerla sobre un parche crema.

## Pendientes: fotografías de platos

Todavía **no existen**. Mientras falten, `DishPhoto` dibuja una reserva con la ruta esperada (solo fuera de producción).
Basta con guardar el PNG con el nombre exacto: se detecta solo, sin tocar código.

Especificaciones comunes:

- **PNG con fondo transparente (recorte real, sin cuadrícula simulada)**, plato completo visible con ~4 % de margen.
- Cuadrado, **1400×1400 px** (la bebida: 840×1400, proporción 3:5).
- Iluminación de campaña publicitaria, vista 3/4 desde arriba, sin texto ni logos dentro de la foto.
- Sombra de contacto suave incluida o ninguna (el sitio añade una sombra dura propia).

| Archivo en `public/images/dishes/` | Plato | Dónde se usa |
|---|---|---|
| `ceviche.png` | Ceviche peruano (con choclo y camote) | Hero, demo La Mar Cevichería |
| `pollo-brasa.png` | Pollo a la brasa con papas | Hero, demo El Gallo Bravo |
| `lomo-saltado.png` | Lomo saltado | Hero, demo Sabor Criollo |
| `chicha-morada.png` (840×1400) | Vaso de chicha morada | Hero |
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
