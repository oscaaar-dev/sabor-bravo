# ADR-0001 — Arquitectura y rendimiento de Sabor Bravo

- **Estado:** PROPUESTO. No hay migración ejecutada ni aprobada.
- **Fecha:** 2026-10-13
- **Origen:** recomendación de arquitectura aportada por el equipo (Astro + Vite + Hono/Bun + Drizzle + Cloudflare + Coolify), contrastada con el estado real del repositorio.

Convención de evidencia usada abajo: **[medido]** = obtenido del build real de este repo; **[razonado]** = se deduce de cómo funciona la tecnología; **[por probar]** = depende de una prueba que todavía no existe.

---

## 1. Diagnóstico del estado real

### Existe y funciona (verificado)
- Next.js 16.4 + React 19 + TypeScript estricto + Tailwind 4. Único código propio: ~1 170 líneas en `src/`.
- Landing completa en `/` (12 componentes, 1 solo componente cliente: `Nav.tsx`), tokens de diseño, logos derivados, fondo oficial.
- `tsc`, `eslint` y `next build` pasan. Revisión visual manual a 1440×900, 1024×768 y 390×844.
- Línea base de la home **[medido]** (build de producción): HTML 91 KB (18 KB gzip), CSS 36 KB (8 KB gzip), **JS 580 KB sin comprimir / 180 KB gzip en 8 scripts**, aunque solo hay un elemento interactivo (el menú móvil).

### Provisional (existe pero no es definitivo)
- Páginas `/login`, `/registro`, `/dashboard`, `/r/[slug]`: son maquetas "En construcción", sin datos ni seguridad.
- Los 3 planes (Inicio/Local/Cadena), los 4 restaurantes demo y el contenido de las FAQ son texto de propuesta, no datos reales.
- Reservas de foto de plato (`DishPhoto`) porque las fotos no existen.

### No existe todavía
Base de datos, migraciones, autenticación, roles, API, carrito, pedidos, subida de imágenes, informes, superadministración, pruebas automáticas, CI, despliegue, variables de entorno, fotos de platos, derivados WebP/AVIF, `sitemap`/`robots`/metadatos OG, y **control de versiones: la carpeta no es un repositorio git**.

### Fases
La Fase 1 está **parcialmente** verificada: faltan Lighthouse/Core Web Vitals, teclado y lector de pantalla, otros navegadores y las fotos reales. Las Fases 2–6 no se han iniciado.

---

## 2. Las dos opciones

### Opción A — Next.js único
Next.js + TS, estático/SSR según la página, PostgreSQL con capa de datos (Drizzle o similar), `next/image`, un solo despliegue.

### Opción B — Arquitectura propuesta
Astro (landing + menús públicos) · React + Vite (dashboard) · Hono + Bun + TS (API) · PostgreSQL + Drizzle · Zod · TanStack Query (+ Router si conviene) · Cloudflare (DNS/CDN) · R2 (archivos) · Coolify en VPS.

---

## 3. Comparación por criterio

| Criterio | A: Next único | B: Astro + Vite + Hono | Evidencia |
|---|---|---|---|
| **Carga y Core Web Vitals (público)** | Siempre envía el runtime de React/Next: 180 KB gzip en una página casi estática. | Astro no envía JS salvo en "islas" que se pidan; la landing podría quedar en pocos KB. | A: **[medido]**. B: **[razonado]**; el valor final **[por probar]**. LCP depende sobre todo de imágenes y fuentes, y eso es igual en ambas. |
| **SEO landing y menús** | HTML prerrenderizado o SSR; sin problemas. | Igual: HTML directo. | Empate **[razonado]**. |
| **Menú público con carrito** | Carrito = componente cliente dentro de RSC. | Carrito = isla React (cuesta ~el runtime de React solo en esa ruta). | La ventaja de B es **grande en la landing y menor en el menú**, porque el menú sí es interactivo. **[por probar]** |
| **Datos cambiantes del menú (precios, agotados)** | ISR/caché de Next integrado. | SSR + `Cache-Control`/`stale-while-revalidate` en CDN; invalidar por evento requiere diseño propio. | **[por probar]**. Mitigación: el precio final siempre lo calcula el servidor al crear el pedido, así que un menú cacheado unos segundos no corrompe totales. |
| **Panel administrativo** | Next sirve; la navegación en servidor aporta poco a una app autenticada. | SPA con Vite + TanStack Query: modelo natural para tablas, filtros y actualización frecuente. | **[razonado]**; en un dashboard autenticado el tamaño de JS importa menos que en lo público. |
| **Seguridad y aislamiento multiempresa** | Reglas en Server Actions/Route Handlers mezcladas con UI; es seguro si se disciplina. | Un único punto de entrada (API) con middleware de auth y tenant; más fácil de auditar y de reutilizar (futura app móvil, bot de WhatsApp). | El aislamiento fuerte lo da **RLS en PostgreSQL**, independiente del framework. **[razonado]** |
| **Autenticación, roles, permisos** | Con Supabase Auth ya está resuelto en Next. | **La propuesta no nombra proveedor de auth.** Construirlo (sesiones, hash, verificación de correo, recuperación) es la mayor tarea oculta. | **[razonado]**; riesgo real de B. |
| **Pedidos y concurrencia** | Transacciones SQL + clave de idempotencia. | Igual. Opcional: SSE/WebSocket desde la API para pedidos en vivo. | Empate; lo decide el diseño SQL, no el framework. |
| **Costos de infraestructura** | Hosting gestionado (Vercel con uso comercial es de pago) o VPS propio. | VPS + Cloudflare (CDN gratuito) + R2 (sin cargo de salida). Menor costo mensual, mayor trabajo operativo. | Precios **a verificar** al momento de decidir; no se cotizan aquí. |
| **Complejidad y mantenimiento** | 1 aplicación, 1 despliegue. | 3 aplicaciones + paquete compartido (monorepo), CORS/cookies entre subdominios, 3 pipelines; si se usa Coolify, además parches, copias de seguridad y monitoreo del VPS. | **[razonado]** |
| **Compatibilidad de dependencias** | Ya instalado y compilando en esta máquina. | Versiones actuales en npm: Astro 7.3, Hono 4.13, Drizzle 0.45, Vite 8.3, TanStack Query 5.104/Router 1.170, Zod 4.6. **Bun no está instalado** aquí; Hono y Drizzle también corren en Node 24 (ya instalado). Compatibilidad real entre ellas: **[por probar]** con un prototipo. | Entorno: sin Bun, sin Docker, sin `psql`. |
| **Crecer sin reescribir** | Se puede extraer la API más adelante si la capa de datos está desacoplada. | Ya nace separado. | **[razonado]** |

### Qué decisiones producen la mejora de B (y cuáles no)
- **Sí producen mejora:** no enviar JS por defecto en páginas públicas; servir HTML estático por CDN; separar el dashboard del sitio público para que no carguen el mismo código.
- **No la producen por sí solas:** Bun frente a Node, Hono frente a Route Handlers, o Drizzle frente a otro ORM. Las consultas SQL bien indexadas y las imágenes bien servidas pesan más que cualquiera de esos nombres.
- **Depende de pruebas:** si Astro bate a Next en el menú con carrito en un móvil de gama media, y cómo se invalida la caché del menú.

### Descartado por ahora (sin necesidad demostrable)
Redis/Valkey, Go, microservicios, TanStack Router (opcional; solo si el dashboard necesita rutas tipadas), R2 y Coolify hasta que haya algo real que servir y operar.

---

## 4. Recomendación

**Arquitectura principal: Opción B, adoptada por etapas y condicionada a un prototipo medible, con tres ajustes sobre lo propuesto.**

Por qué encaja con el estado real:
1. **Ahora es el momento más barato de migrar.** El único código es una landing de ~1 170 líneas sin capa de datos; la migración es mayormente mecánica. Cada fase posterior encarece el cambio.
2. **La superficie comercial es pública y móvil.** Los clientes llegan por QR en celulares de gama media y datos móviles. Hoy la home paga 180 KB gzip de JS por un solo botón de menú.
3. **SaaS multiempresa:** una API única con middleware de tenant y permisos, sobre RLS, es más fácil de auditar.

Ajustes que propongo a la propuesta original:
1. **Mantener Supabase para Auth y PostgreSQL gestionado** (copias de seguridad, RLS, Auth ya hecha), usando Drizzle como capa de consultas y verificando el JWT en Hono. Así se evita construir autenticación propia y operar Postgres en un VPS al inicio. R2 y Coolify se incorporan después, cuando haya algo que operar.
2. **Bun opcional:** Hono corre en Node 24, que ya está instalado. Se decide Bun solo si el prototipo muestra una ventaja o si el despliegue lo pide.
3. **Prototipo antes de comprometerse (criterio de salida):** portar la landing y una ruta `/r/[slug]` a Astro; medir con Lighthouse móvil limitado y peso de JS contra la línea base actual; y probar Hono + Drizzle con creación de pedido idempotente y RLS contra un Postgres real. Si el prototipo no mejora de forma medible o la integración de RLS con Drizzle resulta inmanejable, **se mantiene la Opción A** (con la capa de datos desacoplada para extraer la API después).

---

## 5. Cambios necesarios, impacto y riesgos

### Antes de cualquier migración (bajo riesgo, requieren tu aprobación)
- `git init` y un primer commit: hoy no hay historial y migrar sin él no es reversible.
- Mover el proyecto fuera de OneDrive (la sincronización de `node_modules` ya ralentizó la instalación).
- Un entorno local de PostgreSQL (sin Docker ni `psql` hoy): Docker, Postgres local o un proyecto de Supabase de desarrollo.

### Cambios de la migración (si se aprueba tras el prototipo)
| Qué | Impacto |
|---|---|
| Monorepo (`apps/web` Astro, `apps/dashboard` Vite, `apps/api` Hono, `packages/shared` con Zod y tipos) | Estructura nueva; scripts y CI por aplicación. |
| Landing a `.astro` | Se conserva: tokens CSS, SVG, contenido, copy y scripts de logos. Se reescribe: JSX a `.astro` y el `Nav` como isla mínima. |
| `next/font` → fuentes autoalojadas (Lobster y Montserrat, licencia OFL) | Cambio pequeño; hay que verificar `font-display` y precarga. |
| `next/image` → imágenes de Astro con derivados AVIF/WebP | Los PNG originales de `recursos_sabor/` se conservan; los derivados son adicionales. Dimensiones fijas y carga diferida fuera de pantalla. |
| `DishPhoto` (comprobación con `fs` en servidor) → comprobación en tiempo de build | Mismo comportamiento de reserva. |
| Quitar `next`, `eslint-config-next` | Solo tras verificar la paridad visual. |
| Añadir Astro, Vite, Hono, Drizzle, Zod, TanStack Query | Cada una con justificación en el ADR de su fase. |

### Riesgos principales
1. **RLS con Drizzle:** aplicar el rol y las claims por transacción (`SET LOCAL`) y su convivencia con el pooler de conexiones. Si se usa una conexión que salta RLS, se pierde la defensa en profundidad. Debe probarse.
2. **Carrito en isla de Astro:** estrategia de hidratación y peso real del menú. Puede reducir la ventaja en esa ruta.
3. **Caché de menús:** estrategia de invalidación al cambiar un precio. Hay que diseñarla y medirla.
4. **Cookies y CSRF entre subdominios** (sitio, dashboard, API).
5. **Operación de 3 aplicaciones** y, más adelante, del VPS (copias, parches, monitoreo).
6. **Compatibilidad real** de versiones y de Bun en Windows: sin verificar en esta máquina.
7. **Regresión visual:** la identidad actual (hero, tokens, trazos) debe quedar idéntica; se comprobará a los mismos tres anchos.

### No se hace en esta evaluación
No se migró, borró ni instaló nada. Lo único añadido es este documento.
