# Sabor Bravo

Plataforma de menús digitales y pedidos para restaurantes del Perú: landing, registro, panel del restaurante (carta, pedidos, QR,
informes, equipo) y carta pública con carrito. **Qué funciona, cómo se comprobó y qué falta**: [`docs/ESTADO-APP.md`](docs/ESTADO-APP.md).
Arquitectura: [`docs/ADR-0001-arquitectura.md`](docs/ADR-0001-arquitectura.md).

## Requisitos
- Node.js ≥ 20.9 (se fija la 24 en `.nvmrc`) y npm.

## Puesta en marcha local
```bash
npm ci
cp .env.example .env.local   # ya apunta a la base local
npm run db:dev               # PostgreSQL local embebido (puerto 54329) + migraciones. Déjalo corriendo
npm run dev                  # en otra terminal: http://localhost:3000
```

## Comandos
```bash
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm test             # 177 pruebas sobre un PostgreSQL real (aislamiento, pedidos, roles, informes…)
npm run build        # compilación de producción (no necesita base de datos)
npm run e2e:server   # (otra terminal, tras npm run build) app en :3108 con un Google local falso
npm run test:e2e     # recorrido de 17 pasos en Chrome real
npm run db:migrate   # aplica db/migrations a la base de .env.local (solo bases locales)
npm run db:check     # inspección de solo lectura de la base
npm run db:smoke     # flujo completo dentro de una transacción que se deshace
```

## Recursos gráficos
Los originales de marca están en `recursos_sabor/` y **no se modifican**. Los derivados que usa la web se regeneran con:
```bash
npm run assets:brand    # logos
npm run assets:hero     # fondo del hero y lema
npm run assets:cutout   # recorta fotos de platos con fondo blanco
npm run assets:dishes   # fotos de platos (recursos_sabor/platos/*.webp)
```
Detalle: [`docs/ASSETS.md`](docs/ASSETS.md).

## Producción: Supabase + Netlify
- **Base de datos**: PostgreSQL en Supabase. La cadena de conexión (*Transaction pooler*, puerto 6543) va en `.env.supabase`
  (**ignorado por git**) y se migra con `npm run db:migrate:prod`. Las migraciones remotas exigen `--allow-remote`: `db:migrate`
  se niega a tocar bases que no sean locales.
- **Netlify** (Next.js se detecta solo, sin `netlify.toml`): rama `main`, `npm run build`, Node de `.nvmrc`. Variables de entorno
  en *Site configuration → Environment variables*:

  | Variable | Valor | Secreta |
  |---|---|---|
  | `DATABASE_URL` | cadena del *Transaction pooler* de Supabase | **sí** |
  | `SITE_URL` | `https://sabor-bravo.netlify.app` (o tu dominio), sin barra final | no |
  | `GOOGLE_CLIENT_ID` | ID de cliente de OAuth de Google (ver `docs/ESTADO-APP.md`) | no |
  | `GOOGLE_CLIENT_SECRET` | secreto de ese cliente | **sí** |

## Seguridad
`.env*` (salvo `.env.example`), claves y `node_modules` están en `.gitignore`. No subir credenciales al repositorio.
Modelo de seguridad y límites conocidos: [`docs/ESTADO-APP.md`](docs/ESTADO-APP.md).
