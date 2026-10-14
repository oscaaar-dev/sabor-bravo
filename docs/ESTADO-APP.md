# Estado de la aplicación (SABOR BRAVO)

Última revisión: 14-10-2026. Este documento dice **qué funciona de verdad, cómo se comprobó y qué NO está hecho**.

## Qué funciona (con datos reales en PostgreSQL)

| Área | Qué hace | Dónde |
|---|---|---|
| Cuenta | Registro, inicio y cierre de sesión, validación en servidor, límites de intentos | `src/app/actions/auth.ts`, `src/server/auth/*` |
| Restaurante | Crear/editar, dirección web (slug) única, modalidades (mesa/recojo/delivery), tarifa de delivery, publicar u ocultar | `src/server/domain/businesses.ts` |
| Carta | Categorías y platos (crear, editar, eliminar), precio, descripción, imagen por URL https, disponible/oculto, promoción con fecha de fin | `src/server/domain/catalog.ts` |
| Carta pública | `/r/<slug>` con solo platos publicados y disponibles; 404 real; carrito; seguimiento del pedido por token | `src/app/r/[slug]/*` |
| Pedidos | Precios, totales, delivery y numeración calculados en el servidor; idempotencia; máquina de estados | `src/server/domain/orders.ts` |
| Panel | Lista y detalle de pedidos con renovación automática cada 8–10 s, cambio de estado, historial | `src/app/dashboard/[slug]/pedidos` |
| QR | PNG y SVG descargables, apuntan a la URL pública | `src/app/dashboard/[slug]/qr` |
| Informes | Ventas, ticket medio, por día y modalidad, más vendidos, descuentos (solo pedidos completados) | `src/server/domain/reports.ts` |
| CSV | Pedidos y líneas, con protección contra inyección de fórmulas | `src/app/dashboard/[slug]/informes/csv` |
| Roles | Propietario / administrador / personal, comprobados en servidor | `src/lib/permissions.ts`, `src/server/domain/team.ts` |

## Modelo de seguridad

- **Autenticación propia**: contraseñas con scrypt (sal por contraseña); sesión = token aleatorio de 256 bits en cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` y prefijo `__Host-` en producción); en la base solo se guarda su SHA-256.
- **Aislamiento entre restaurantes**: toda consulta filtra por `business_id`; las relaciones usan **claves foráneas compuestas** `(id, business_id)`, así que la propia base rechaza mezclar datos de dos restaurantes; el acceso al panel pasa siempre por `getBusinessAccess` (no miembro → 404).
- **Nunca se confía en el navegador**: el cliente envía solo qué productos y cuántas unidades; precios, promociones, disponibilidad, delivery y totales los calcula el servidor en una transacción.
- **RLS activado sin políticas** en todas las tablas (migración 0003): defensa en profundidad si algún día se habilitara la API pública de Supabase. La app se conecta como propietaria (no le afecta).
- Cabeceras: `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS (producción) y una CSP parcial (`object-src`, `base-uri`, `form-action`, `frame-ancestors`).
- No se registran contraseñas ni secretos (hay una prueba que lo vigila).

## Cómo se comprobó

- `npm test`: **139 pruebas** sobre un PostgreSQL 17 real embebido (aislamiento, pedidos, idempotencia, concurrencia, estados, informes, roles, validación, seguridad). Mutación manual: 10 de 11 mutantes de seguridad detectados (el undécimo es equivalente).
- `npm run test:e2e`: recorrido de **12 pasos en Chrome real** (registro → … → aislamiento, promoción/informes/CSV, roles). Requiere la app en el puerto 3108 con `SITE_URL=http://localhost:3108`.
- `npm run db:smoke[:prod]`: flujo completo dentro de una transacción que se **deshace**, para comprobar una base real sin dejar datos. Ejecutado contra Supabase: 13/13.

## Cómo usarlo

```bash
npm run db:dev          # PostgreSQL local (puerto 54329), aplica migraciones
npm run dev             # app en http://localhost:3000
npm test                # pruebas
```

## Producción (Supabase + Netlify)

1. Base: proyecto Supabase `sabor-bravo` (Ohio, plan gratuito, Data API desactivada). Migraciones: `npm run db:migrate:prod` (lee `.env.production.local`, que **nunca** se sube a git).
2. Netlify → *Site configuration → Environment variables*: `DATABASE_URL` (cadena del *Transaction pooler*, puerto 6543, secreta) y `SITE_URL=https://sabor-bravo.netlify.app`.
3. `git push` a `main` → Netlify compila (no necesita la base para compilar) y publica.

## Lo que NO está hecho (no simular)

- Recuperar contraseña y verificar correo (no hay envío de correos).
- Sucursales (un restaurante = un local).
- Subida de imágenes (solo URL https).
- CSP estricta con nonces (hoy parcial).
- Pagos online (a propósito: se paga al recibir).
- Notificaciones push/sonido de pedido nuevo (hoy: consulta periódica cada 8–10 s).
- No probado en producción con tráfico real ni con una auditoría externa.
