# Estado de la aplicación (SABOR BRAVO)

Última revisión: 14-10-2026. Este documento dice **qué funciona de verdad, cómo se comprobó y qué NO está hecho**.

## Qué funciona (con datos reales en PostgreSQL)

| Área | Qué hace | Dónde |
|---|---|---|
| Cuenta | Registro, inicio y cierre de sesión (correo/contraseña **o Google**), validación en servidor, límites de intentos | `src/app/actions/auth.ts`, `src/server/auth/*` |
| Acceso con Google | OpenID Connect propio (código + PKCE + state + nonce + firma RS256); misma sesión que el correo; vinculación segura | `src/app/auth/google/*`, `src/server/auth/oauth/*`, `src/server/domain/oauth.ts` |
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

## Acceso con Google (OpenID Connect)

**Estado: código terminado y probado contra un Google LOCAL FALSO. NO probado con el Google real**: faltan las credenciales (ver abajo).

No se usa Supabase Auth: el proyecto tiene su propia autenticación y Supabase solo aloja la base de datos. Para no crear un segundo sistema de sesiones, el flujo de Google habla directamente con Google y, al terminar, emite **la misma sesión** (misma cookie, misma tabla) que usa el correo con contraseña.

Flujo: `/auth/google/start` (genera `state`, `nonce` y verificador PKCE; guarda solo el hash del state) → Google → `/auth/google/callback` (compara el state con la cookie del navegador, lo consume una sola vez, intercambia el código en el servidor con PKCE y el secreto, valida el id_token: firma RS256, emisor, audiencia, caducidad y nonce; exige correo verificado).

Reglas de cuentas (`src/server/domain/oauth.ts`):
- El enlace identidad↔cuenta se hace por el **`sub`** de Google, nunca por coincidencia de correo.
- Primer acceso: se crea una cuenta **sin contraseña**, correo verificado, **sin restaurantes ni permisos especiales**, y va a crear su restaurante. Siguientes accesos: el mismo perfil y su panel (con un restaurante entra directo a sus pedidos).
- Si el correo de Google ya pertenece a una cuenta con contraseña: **no se vincula sola ni se duplica**; queda un enlace pendiente (10 min, un solo uso) que solo se completa escribiendo la contraseña de esa cuenta (limitado por intentos). Así se conservan sus restaurantes y roles.
- Una cuenta de Google no puede entrar con correo y contraseña (no tiene contraseña).

### Configuración externa pendiente (la haces tú)

1. **Google Cloud Console** (https://console.cloud.google.com) → crea o elige un proyecto.
2. *APIs y servicios → Pantalla de consentimiento de OAuth*: tipo **Externo**, nombre «Sabor Bravo», correo de soporte, y ámbitos `openid`, `email`, `profile` (son los básicos, no requieren verificación). Mientras la app esté en modo *Pruebas*, añade en «Usuarios de prueba» los correos que podrán entrar; para abrirla a todos hay que *Publicar la aplicación*.
3. *Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web*. En **URI de redirección autorizadas** añade exactamente:
   - `https://sabor-bravo.netlify.app/auth/google/callback`
   - `http://localhost:3000/auth/google/callback` (para probar en local)
4. Copia el **ID de cliente** y el **Secreto**. El secreto no se puede volver a ver en claro: guárdalo en tu gestor de contraseñas.
5. **Local**: pon `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env.local` (ignorado por git) y prueba con `npm run dev`.
6. **Netlify** → *Environment variables*: crea `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (esta última marcada como **secreta**, igual que `DATABASE_URL`).
7. **Orden obligatorio al publicar**: primero aplica la migración 0004 a Supabase (`npm run db:migrate:prod`), **después** haz `git push`. El código nuevo escribe la columna `users.email_verified_at`; si se publica antes que la migración, el registro con correo falla (ya pasó en una prueba local).
8. Prueba el flujo real con tu cuenta de Google y confirma los 7 puntos de la lista de comprobación de abajo.

Hasta que existan las dos variables, el botón se ve pero lleva a «El acceso con Google todavía no está disponible».

## Cómo se comprobó

- `npm test`: **177 pruebas** sobre un PostgreSQL 17 real embebido (aislamiento, pedidos, idempotencia, concurrencia, estados, informes, roles, validación, seguridad y 38 del acceso con Google: firma/nonce/audiencia/emisor/caducidad del id_token, PKCE, state de un solo uso, política de vinculación). Mutación manual: 10 de 11 mutantes de la app detectados (el undécimo es equivalente) y 13 de 13 del acceso con Google (+1 de cookie/state detectado por el recorrido e2e).
- `npm run test:e2e`: recorrido de **17 pasos en Chrome real** (los 12 de la app + 5 del acceso con Google contra un «Google» local que verifica PKCE/state/secreto/uso único). Arranca antes `npm run build && npm run e2e:server` (puerto 3108).
- `npm run db:smoke[:prod]`: flujo completo dentro de una transacción que se **deshace**, para comprobar una base real sin dejar datos. Ejecutado contra Supabase: 13/13.

## Cómo usarlo

```bash
npm run db:dev          # PostgreSQL local (puerto 54329), aplica migraciones
npm run dev             # app en http://localhost:3000
npm test                # pruebas
```

## Producción (Supabase + Netlify)

> ⚠️ La cadena de Supabase vive en `.env.supabase`, **no** en `.env.production.local`: `next start` y `next build` cargan automáticamente `.env.production.local`, y eso haría que una prueba local en modo producción escribiera en la base real. `.env.supabase` solo lo leen los scripts `db:*:prod`.

1. Base: proyecto Supabase `sabor-bravo` (Ohio, plan gratuito, Data API desactivada). Migraciones: `npm run db:migrate:prod` (lee `.env.supabase`, que **nunca** se sube a git).
2. Netlify → *Site configuration → Environment variables*: `DATABASE_URL` (cadena del *Transaction pooler*, puerto 6543, secreta), `SITE_URL=https://sabor-bravo.netlify.app` y, para Google, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (secreta).
3. **Migración 0004 antes del despliegue**: el código nuevo usa `users.email_verified_at` y las tablas `oauth_*`; es compatible hacia atrás (el código antiguo sigue funcionando con la migración aplicada), pero no al revés.
4. `git push` a `main` → Netlify compila (no necesita la base para compilar) y publica.

## Lo que NO está hecho (no simular)

- Recuperar contraseña y verificar correo (no hay envío de correos).
- Sucursales (un restaurante = un local).
- Subida de imágenes (solo URL https).
- CSP estricta con nonces (hoy parcial).
- Pagos online (a propósito: se paga al recibir).
- Notificaciones push/sonido de pedido nuevo (hoy: consulta periódica cada 8–10 s).
- No probado en producción con tráfico real ni con una auditoría externa.
