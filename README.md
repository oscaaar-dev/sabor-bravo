# Sabor Bravo

Plataforma de menús digitales y pedidos para restaurantes del Perú. Este repositorio contiene la **landing** (Next.js) y las
rutas provisorias del menú público y del panel. **Todavía no hay base de datos, autenticación ni pedidos reales**: ver
[`docs/ADR-0001-arquitectura.md`](docs/ADR-0001-arquitectura.md).

## Requisitos
- Node.js ≥ 20.9 (se fija la 24 en `.nvmrc`) y npm.

## Comandos
```bash
npm ci              # instalación reproducible
npm run dev         # desarrollo en http://localhost:3000
npm run lint        # ESLint
npm run typecheck   # TypeScript (tsc --noEmit)
npm run build       # compilación de producción
npm start           # sirve la compilación
```

## Recursos gráficos
Los originales de marca están en `recursos_sabor/` y **no se modifican**. Los derivados que usa la web se regeneran con:
```bash
npm run assets:brand    # logos
npm run assets:hero     # fondo del hero y lema
npm run assets:dishes   # fotos de platos (recursos_sabor/platos/*.webp)
```
Detalle y fotos pendientes: [`docs/ASSETS.md`](docs/ASSETS.md).

## Desplegar en Netlify
Next.js ≥ 13.5 funciona en Netlify **sin configuración adicional**: el adaptador se instala solo y `next/image` usa el CDN de
imágenes de Netlify. No hace falta `netlify.toml`.

1. En Netlify: *Add new project → Import an existing project → GitHub* y elige este repositorio.
2. Rama de producción: `main`. Netlify detecta Next.js y propone `npm run build`; deja los valores por defecto.
3. La versión de Node sale de `.nvmrc` (24).
4. **Variables de entorno: ninguna.** La app no usa ninguna ahora mismo. Cuando se añada Supabase se documentarán en un `.env.example`
   (las claves secretas nunca se suben a git).

## Seguridad
`.env*`, claves y `node_modules` están en `.gitignore`. No subir credenciales al repositorio.
