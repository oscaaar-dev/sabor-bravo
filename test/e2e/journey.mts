/**
 * Recorrido de extremo a extremo en un navegador REAL (Chrome) contra la aplicación en marcha:
 *   registro → sesión → restaurante → carta → carta pública → QR → pedido de un cliente → panel → estados → aislamiento.
 *
 *   1) npm run db:dev            (base local)        2) npm run build && npm start -- -p 3108      3) npm run test:e2e
 *
 * Variables: BASE_URL (por defecto http://localhost:3108), CHROME_PATH.
 * Crea cuentas y restaurantes de prueba con nombres únicos en la base LOCAL; no borra nada.
 */
import assert from "node:assert/strict";
import postgres from "postgres";
import QRCode from "qrcode";
import puppeteer, { type BrowserContext, type Page } from "puppeteer-core";
import { startMockGoogle, type Persona } from "./mock-google.mts";

const BASE = process.env.BASE_URL ?? "http://localhost:3108";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const stamp = Date.now().toString(36);
const OWNER = { name: "Rosa Quispe", email: `rosa.${stamp}@prueba.pe`, password: "una-frase-larga-segura-1" };
const OTHER = { name: "Otro Dueño", email: `otro.${stamp}@prueba.pe`, password: "otra-frase-larga-segura-2" };
const SLUG = `la-mar-${stamp}`;
const SLUG_OTHER = `otro-${stamp}`;

const results: Array<{ step: string; ok: boolean; detail?: string }> = [];
async function step(name: string, fn: () => Promise<void>) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ step: name, ok: true });
    console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    const detail = e instanceof Error ? e.message.split("\n").slice(0, 6).join(" | ") : String(e);
    results.push({ step: name, ok: false, detail });
    console.log(`  ✗ ${name}\n      ${detail}`);
    // diagnóstico: URL y texto visible de las páginas abiertas (y captura si se pide con E2E_SHOTS=carpeta)
    for (const ctx of [owner, customer, other]) {
      for (const [i, pg] of (await ctx.pages()).entries()) {
        const body = (await pg.evaluate(() => document.body.innerText).catch(() => "")).replace(/\s+/g, " ").slice(0, 500);
        console.log(`      · ${pg.url()}\n        «${body}»`);
        if (process.env.E2E_SHOTS) await pg.screenshot({ path: `${process.env.E2E_SHOTS}/fallo-${results.length}-${i}.png` }).catch(() => undefined);
      }
    }
    throw e;
  }
}

// Repetir el recorrido muchas veces agotaría los límites de intentos (registro: 6/hora por IP). En la base LOCAL se reinician.
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && /@(127\.0\.0\.1|localhost)[:/]/.test(dbUrl)) {
  const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
  await sql`delete from rate_limits`;
  await sql.end({ timeout: 5 });
  console.log("(límites de intentos de la base LOCAL reiniciados para esta ejecución)");
}

// «Google» local para el flujo OAuth. La app debe arrancarse con GOOGLE_CLIENT_ID/SECRET y OAUTH_TEST_MODE=1 apuntando a él
// (ver docs/ESTADO-APP.md); si no, los pasos de Google se omiten y se avisa.
const MOCK_PORT = Number(process.env.MOCK_GOOGLE_PORT ?? 4455);
const mock = await startMockGoogle({ port: MOCK_PORT, clientId: process.env.GOOGLE_CLIENT_ID ?? "test-client-id.apps.googleusercontent.com", clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "test-client-secret" });
const googleSql = dbUrl && /@(127\.0\.0\.1|localhost)[:/]/.test(dbUrl) ? postgres(dbUrl, { max: 1, onnotice: () => {} }) : null;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const newPage = async (ctx: BrowserContext, w = 1280, h = 900) => {
  const p = await ctx.newPage();
  await p.setViewport({ width: w, height: h });
  p.setDefaultTimeout(20_000);
  return p;
};
const go = (p: Page, path: string) => p.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
/** Texto visible de la página. `includes` ignora mayúsculas: varios titulares se muestran en mayúsculas por CSS. */
class Visible extends String {
  override includes(search: string): boolean {
    return this.toLowerCase().includes(search.toLowerCase());
  }
}
const text = async (p: Page) => new Visible(await p.evaluate(() => document.body.innerText)) as Visible & string;
const waitText = (p: Page, t: string) => p.waitForFunction((x) => document.body.innerText.toLowerCase().includes(x.toLowerCase()), {}, t);
/** Espera a que la ETIQUETA de estado del pedido (no un botón con texto parecido) muestre ese estado. */
const waitBadge = (p: Page, t: string) => p.waitForFunction((x) => [...document.querySelectorAll(".badge")].some((b) => b.textContent?.trim().toLowerCase() === x.toLowerCase()), {}, t);
const waitPath = (p: Page, re: RegExp) => p.waitForFunction((src) => new RegExp(src).test(location.pathname + location.search), {}, re.source);
async function fill(p: Page, selector: string, value: string) {
  await p.click(selector, { clickCount: 3 });
  await p.type(selector, value);
}
/** Captura de pantalla de revisión visual (solo si E2E_SHOTS apunta a una carpeta). */
const snap = async (p: Page, name: string) => {
  if (process.env.E2E_SHOTS) await p.screenshot({ path: `${process.env.E2E_SHOTS}/ui-${name}.png`, fullPage: true }).catch(() => undefined);
};
/** Pulsa el botón de envío del formulario que contiene el campo `anchor` (en el panel, el primer submit de la página es «Cerrar sesión»). */
async function submit(p: Page, anchor: string) {
  const handle = await p.evaluateHandle((a) => document.querySelector<HTMLInputElement>(a)?.form?.querySelector<HTMLButtonElement>("button[type=submit]") ?? null, anchor);
  const el = handle.asElement();
  assert.ok(el, `no hay botón de envío para ${anchor}`);
  await el.click();
}
/** Estado HTTP de una petición con la sesión de esa página. Una redirección (que el navegador oculta con redirect:"manual") se informa como 307. */
const status = (p: Page, path: string) =>
  p.evaluate(
    async (u) => {
      const r = await fetch(u, { credentials: "include", redirect: "manual" });
      return r.type === "opaqueredirect" ? 307 : r.status;
    },
    `${BASE}${path}`,
  );

const owner = await browser.createBrowserContext();
const customer = await browser.createBrowserContext();
const other = await browser.createBrowserContext();
let orderId = "";

try {
  const op = await newPage(owner);
  console.log(`\nSABOR BRAVO · recorrido e2e contra ${BASE}\n`);

  await step("1. Registrar una cuenta (validaciones incluidas)", async () => {
    await go(op, "/registro");
    await snap(op, "registro");
    // contraseña corta → mensaje útil, sin crear la cuenta
    await fill(op, "#name", OWNER.name);
    await fill(op, "#email", OWNER.email);
    await fill(op, "#password", "corta");
    await submit(op, "#password");
    await waitText(op, "al menos 10 caracteres");
    // datos correctos
    await fill(op, "#password", OWNER.password);
    await submit(op, "#password");
    await waitPath(op, /^\/dashboard\/nuevo/);
    const cookies = await op.cookies();
    const session = cookies.find((c) => c.name.endsWith("sb_session"));
    assert.ok(session, "no se creó la cookie de sesión");
    assert.equal(session.httpOnly, true, "la cookie de sesión debe ser HttpOnly");
    assert.equal(session.sameSite, "Lax");
    assert.ok(!(await op.evaluate(() => document.cookie)).includes("sb_session"), "JavaScript no debe poder leer la cookie");
  });

  await step("2. Cerrar sesión e iniciar sesión (clave errónea rechazada)", async () => {
    await op.click("form button[type=submit]"); // «Cerrar sesión»
    await waitPath(op, /^\/$/);
    assert.equal(await status(op, "/dashboard"), 307, "tras cerrar sesión /dashboard debe redirigir al login");
    await go(op, "/dashboard");
    await waitPath(op, /^\/login/);
    await fill(op, "#email", OWNER.email);
    await fill(op, "#password", "clave-equivocada-99");
    await submit(op, "#password");
    await waitText(op, "Correo o contraseña incorrectos");
    await fill(op, "#password", OWNER.password);
    await submit(op, "#password");
    await waitPath(op, /^\/dashboard/);
    assert.ok(!/login/.test(op.url()), "debería haber entrado al panel");
  });

  await step("3. Crear un restaurante (dirección única)", async () => {
    await go(op, "/dashboard/nuevo");
    await fill(op, "#name", "La Mar E2E");
    await fill(op, "#slug", SLUG);
    await fill(op, "#description", "Cevichería de prueba automatizada");
    await op.click("[name=acceptsDelivery]");
    await fill(op, "#deliveryFee", "6.50");
    await submit(op, "#name");
    await waitPath(op, new RegExp(`^/dashboard/${SLUG}/carta`));
    await waitText(op, "Tu carta");
  });

  await step("4. Crear una categoría y varios platos (incluido uno agotado y uno oculto)", async () => {
    await fill(op, "#cat-new-name", "Entradas");
    await submit(op, "#cat-new-name");
    await waitText(op, "Entradas (0)");
    const addProduct = async (name: string, price: string, opts: { agotado?: boolean; oculto?: boolean } = {}) => {
      await op.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
      const f = "form[data-form=product-new]";
      await fill(op, `${f} [name=name]`, name);
      await fill(op, `${f} [name=price]`, price);
      if (opts.agotado) await op.click(`${f} [name=isAvailable]`);
      if (opts.oculto) await op.click(`${f} [name=isPublished]`);
      await op.click(`${f} button[type=submit]`);
      await waitText(op, `«${name}» añadido a la carta`);
    };
    await addProduct("Ceviche clásico", "35");
    await addProduct("Chicha morada", "8,50");
    await addProduct("Lomo agotado", "45", { agotado: true });
    await addProduct("Plato oculto", "20", { oculto: true });
    await go(op, `/dashboard/${SLUG}/carta`);
    await snap(op, "carta");
    const t = await text(op);
    for (const n of ["Ceviche clásico", "Chicha morada", "Lomo agotado", "Plato oculto"]) assert.ok(t.includes(n), `falta ${n} en el panel`);
    assert.ok(t.includes("Agotado") && t.includes("Oculto"));
    assert.ok(t.includes("S/ 35.00") && t.includes("S/ 8.50"), "precios mal guardados");
    // validaciones de servidor: precio inválido
    await op.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await fill(op, "form[data-form=product-new] [name=name]", "Con precio malo");
    await fill(op, "form[data-form=product-new] [name=price]", "gratis");
    await op.click("form[data-form=product-new] button[type=submit]");
    await waitText(op, "escribe un importe válido");
  });

  await step("5. Abrir la carta pública (solo platos disponibles y publicados) y el 404 real", async () => {
    const cp = await newPage(customer, 390, 844);
    await go(cp, `/r/${SLUG}`);
    await snap(cp, "menu-movil");
    const t = await text(cp);
    assert.ok(t.includes("La Mar E2E") && t.includes("Ceviche clásico") && t.includes("Chicha morada"));
    assert.ok(!t.includes("Lomo agotado"), "no debe mostrarse un plato agotado");
    assert.ok(!t.includes("Plato oculto"), "no debe mostrarse un plato oculto");
    assert.equal(await status(cp, "/r/restaurante-que-no-existe"), 404);
    await cp.close();
  });

  await step("6. Generar y descargar el QR (apunta a la URL pública real)", async () => {
    await go(op, `/dashboard/${SLUG}/qr`);
    await snap(op, "qr");
    const shown = (await op.$eval("[data-testid=qr-url]", (el) => el.textContent ?? "")).trim();
    assert.equal(shown, `${new URL(BASE).origin}/r/${SLUG}`.replace(/^http:\/\/127\.0\.0\.1/, "http://localhost"));
    const png = await op.evaluate(async (u) => {
      const r = await fetch(u, { credentials: "include" });
      const b = new Uint8Array(await r.arrayBuffer());
      return { status: r.status, type: r.headers.get("content-type"), disp: r.headers.get("content-disposition"), head: Array.from(b.slice(0, 8)), len: b.length };
    }, `${BASE}/dashboard/${SLUG}/qr/image?format=png&download=1`);
    assert.equal(png.status, 200);
    assert.equal(png.type, "image/png");
    assert.deepEqual(png.head, [137, 80, 78, 71, 13, 10, 26, 10], "no es un PNG válido");
    assert.match(png.disp ?? "", /attachment; filename="qr-.*\.png"/);
    assert.ok(png.len > 2000, "el PNG parece vacío");
    // el SVG descargado codifica EXACTAMENTE la URL pública (se compara con el generado de forma independiente)
    const svg = await op.evaluate(async (u) => (await fetch(u, { credentials: "include" })).text(), `${BASE}/dashboard/${SLUG}/qr/image?format=svg&download=1`);
    const expected = await QRCode.toString(shown, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#202321", light: "#FFFFFF" } });
    assert.equal(svg, expected, "el QR no codifica la URL pública esperada");
  });

  await step("7. Enviar un pedido como cliente (recojo) y ver su seguimiento", async () => {
    const cp = await newPage(customer, 390, 844);
    await go(cp, `/r/${SLUG}`);
    const addBy = async (name: string, times: number) => {
      for (let i = 0; i < times; i++) {
        if (i === 0) await cp.click(`[data-product="${name}"] button[aria-label^="Agregar"]`);
        else await cp.click(`[data-product="${name}"] button[aria-label^="Añadir una unidad"]`);
      }
    };
    await addBy("Ceviche clásico", 2);
    await addBy("Chicha morada", 1);
    await cp.click("[data-testid=open-cart]");
    await waitText(cp, "Tu pedido");
    assert.equal(await cp.$eval("[data-testid=cart-total]", (e) => e.textContent), "S/ 78.50");
    await snap(cp, "carrito-movil");
    // por defecto es «En mesa»: sin número de mesa el servidor lo rechaza y no se crea el pedido
    await cp.click("[data-testid=send-order]");
    await waitText(cp, "Indica tu número de mesa");
    // el cliente elige «Recojo»; sin nombre ni teléfono, el servidor también lo rechaza
    await cp.evaluate(() => [...document.querySelectorAll<HTMLLabelElement>("label.tab")].find((l) => l.textContent?.trim() === "Recojo")?.click());
    await cp.click("[data-testid=send-order]");
    await waitText(cp, "Escribe tu nombre");
    await cp.type("#order-customerName", "Ana Cliente");
    await cp.type("#order-customerPhone", "999 111 222");
    await cp.click("[data-testid=send-order]");
    await waitPath(cp, new RegExp(`^/r/${SLUG}/pedido/`));
    await waitText(cp, "Pedido #1");
    await snap(cp, "seguimiento-movil");
    assert.equal(await cp.$eval("[data-testid=public-total]", (e) => e.textContent), "S/ 78.50");
    assert.ok((await text(cp)).includes("Pendiente"));
    (globalThis as Record<string, unknown>).__trackingUrl = cp.url();
    // un reenvío (recarga/atrás) no duplica el pedido: el carrito quedó vacío
    await go(cp, `/r/${SLUG}`);
    assert.ok(!(await text(cp)).includes("Ver mi pedido"), "el carrito debería estar vacío tras el pedido");
    await cp.close();
  });

  await step("8. Ver el pedido en el panel del restaurante", async () => {
    await go(op, `/dashboard/${SLUG}/pedidos`);
    await waitText(op, "Ana Cliente");
    await snap(op, "pedidos");
    const t = await text(op);
    assert.ok(t.includes("#1") && t.includes("S/ 78.50") && t.includes("Pendiente") && t.includes("Recojo"));
    await op.click("[data-order-number='1']");
    await waitText(op, "Pedido #1");
    await snap(op, "pedido-detalle");
    orderId = op.url().split("/").pop() ?? "";
    const d = await text(op);
    for (const x of ["Ceviche clásico", "2 ×", "Chicha morada", "999 111 222", "S/ 78.50"]) assert.ok(d.includes(x), `falta «${x}» en el detalle`);
  });

  await step("9. Cambiar el estado (solo transiciones válidas) y verlo el cliente", async () => {
    const click = async (s: string) => {
      await op.click(`[data-status-action="${s}"]`);
    };
    // desde «Pendiente» no se ofrece «Marcar como listo»
    assert.equal((await op.$("[data-status-action=ready]")) === null, true, "no debe ofrecerse un salto de estado");
    await click("confirmed");
    await waitBadge(op, "Confirmado");
    await click("preparing");
    await waitBadge(op, "En preparación");
    // el cliente ve el estado actualizado
    const cp = await newPage(customer, 390, 844);
    await cp.goto((globalThis as Record<string, unknown>).__trackingUrl as string, { waitUntil: "networkidle2" });
    assert.ok((await text(cp)).includes("En preparación"));
    await click("ready");
    await waitBadge(op, "Listo");
    await click("completed");
    await waitBadge(op, "Completado");
    await waitText(op, "ya no admite cambios");
    await cp.reload({ waitUntil: "networkidle2" });
    assert.ok((await text(cp)).includes("Completado"));
    await cp.close();
    // el historial registra quién lo hizo
    assert.ok((await text(op)).includes("por Rosa Quispe"));
  });

  await step("10. Otro restaurante no puede acceder a esos datos", async () => {
    const xp = await newPage(other);
    await go(xp, "/registro");
    await fill(xp, "#name", OTHER.name);
    await fill(xp, "#email", OTHER.email);
    await fill(xp, "#password", OTHER.password);
    await submit(xp, "#password");
    await waitPath(xp, /^\/dashboard\/nuevo/);
    await fill(xp, "#name", "Local de Otro");
    await fill(xp, "#slug", SLUG_OTHER);
    await submit(xp, "#slug");
    await waitPath(xp, new RegExp(`^/dashboard/${SLUG_OTHER}/carta`));
    // su propio panel funciona y NO contiene el pedido de La Mar
    await go(xp, `/dashboard/${SLUG_OTHER}/pedidos`);
    assert.ok((await text(xp)).includes("Todavía no hay pedidos"));
    assert.ok(!(await text(xp)).includes("Ana Cliente"));
    // acceso cruzado a TODO lo del restaurante A → 404 (no se revela que existe)
    for (const path of [
      `/dashboard/${SLUG}/pedidos`,
      `/dashboard/${SLUG}/pedidos/${orderId}`,
      `/dashboard/${SLUG}/carta`,
      `/dashboard/${SLUG}/ajustes`,
      `/dashboard/${SLUG}/qr`,
      `/dashboard/${SLUG}/qr/image?format=png`,
    ]) {
      const s = await status(xp, path);
      assert.equal(s, 404, `${path} debería dar 404 para otro restaurante y dio ${s}`);
    }
    // sin sesión: redirección al login (páginas) o 401 (QR)
    const anon = await browser.createBrowserContext();
    const ap = await newPage(anon);
    await go(ap, "/login"); // mismo origen que la web: si no, CORS bloquea el fetch desde about:blank
    assert.equal(await status(ap, `/dashboard/${SLUG}/pedidos`), 307);
    assert.equal(await status(ap, `/dashboard/${SLUG}/qr/image?format=png`), 307, "sin cookie, el proxy redirige también el QR");
    // cookie FALSA (pasa el proxy, que solo mira que exista): el servidor la valida contra la base de datos y la rechaza
    const cookieName = (await op.cookies()).find((c) => c.name.endsWith("sb_session"))?.name ?? "sb_session";
    await ap.setCookie({ name: cookieName, value: "x".repeat(43), url: BASE, path: "/", httpOnly: true, secure: cookieName.startsWith("__Host-") });
    assert.equal(await status(ap, `/dashboard/${SLUG}/qr/image?format=png`), 401, "una cookie falsa debe dar 401 en el QR");
    assert.equal(await status(ap, `/dashboard/${SLUG}/pedidos`), 307, "una cookie falsa debe llevar al login");
    assert.equal(await status(ap, `/dashboard/${SLUG}/pedidos/${orderId}`), 307);
    // la consulta pública del pedido de A con el slug de B tampoco funciona
    const trackingPath = new URL((globalThis as Record<string, unknown>).__trackingUrl as string).pathname;
    assert.equal(await status(ap, trackingPath.replace(`/r/${SLUG}/`, `/r/${SLUG_OTHER}/`)), 404);
    assert.equal(await status(ap, trackingPath), 200);
    await anon.close();
    await xp.close();
  });
  await step("11. Promoción, informes calculados desde pedidos reales y CSV seguro", async () => {
    // el dueño pone un 50 % de descuento a la chicha
    await go(op, `/dashboard/${SLUG}/carta`);
    await op.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    const row = 'li[data-product="Chicha morada"]';
    await fill(op, `${row} [name=promoPercent]`, "50");
    await submit(op, `${row} [name=promoPercent]`);
    await waitText(op, "Plato actualizado");
    // la carta pública muestra el precio tachado y el vigente
    const cp = await newPage(customer, 390, 844);
    await go(cp, `/r/${SLUG}`);
    const card = await cp.$eval('[data-product="Chicha morada"]', (e) => (e as HTMLElement).innerText);
    assert.ok(card.includes("S/ 8.50") && card.includes("S/ 4.25") && /promo/i.test(card), `la promoción no se muestra: ${card}`);
    // un cliente con nombre malicioso compra con promoción
    await cp.click('[data-product="Chicha morada"] button[aria-label^="Agregar"]');
    await cp.click("[data-testid=open-cart]");
    await waitText(cp, "Tu pedido");
    assert.equal(await cp.$eval("[data-testid=cart-total]", (e) => e.textContent), "S/ 4.25");
    await cp.evaluate(() => [...document.querySelectorAll<HTMLLabelElement>("label.tab")].find((l) => l.textContent?.trim() === "Recojo")?.click());
    await cp.type("#order-customerName", "=2+2");
    await cp.type("#order-customerPhone", "999 000 111");
    await cp.click("[data-testid=send-order]");
    await waitPath(cp, new RegExp(`^/r/${SLUG}/pedido/`));
    await waitText(cp, "Pedido #2");
    assert.equal(await cp.$eval("[data-testid=public-total]", (e) => e.textContent), "S/ 4.25", "el servidor debe cobrar el precio con promoción");
    await cp.close();
    // el dueño completa el pedido #2
    await go(op, `/dashboard/${SLUG}/pedidos`);
    await op.click("[data-order-number='2']");
    await waitText(op, "Pedido #2");
    for (const [action, badge] of [["confirmed", "Confirmado"], ["preparing", "En preparación"], ["ready", "Listo"], ["completed", "Completado"]] as const) {
      await op.click(`[data-status-action="${action}"]`);
      await waitBadge(op, badge);
    }
    // informes: 78.50 (pedido #1) + 4.25 (pedido #2) = 82.75; 2 completados; descuento 4.25
    await go(op, `/dashboard/${SLUG}/informes`);
    await snap(op, "informes");
    assert.equal(await op.$eval("[data-testid=stat-revenue]", (e) => e.textContent), "S/ 82.75");
    assert.equal(await op.$eval("[data-testid=stat-completed]", (e) => e.textContent), "2");
    assert.equal(await op.$eval("[data-testid=stat-avg]", (e) => e.textContent), "S/ 41.38"); // 82.75 / 2 = 41.375 → 41.38
    const t = await text(op);
    assert.ok(t.includes("Descontado por promociones: S/ 4.25"), "falta el descuento en el informe");
    assert.ok(t.includes("Ceviche clásico") && t.includes("Chicha morada"), "faltan los más vendidos");
    // CSV: BOM, cabecera, datos reales y la fórmula maliciosa neutralizada
    const csv = await op.evaluate(async (u) => {
      const r = await fetch(u, { credentials: "include" });
      // r.text() descarta el BOM por especificación: se leen los bytes crudos y se decodifica conservándolo
      const bytes = new Uint8Array(await r.arrayBuffer());
      return {
        status: r.status,
        type: r.headers.get("content-type"),
        disp: r.headers.get("content-disposition"),
        bom: Array.from(bytes.slice(0, 3)),
        body: new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes),
      };
    }, `${BASE}/dashboard/${SLUG}/informes/csv?tipo=pedidos`);
    assert.deepEqual(csv.bom, [0xef, 0xbb, 0xbf], "el CSV debe empezar con el BOM UTF-8");
    assert.equal(csv.status, 200);
    assert.match(csv.type ?? "", /^text\/csv/);
    assert.match(csv.disp ?? "", /attachment; filename=".*pedidos.*\.csv"/);
    assert.ok(csv.body.startsWith("﻿\"Pedido\""), "el CSV debe llevar BOM y cabecera");
    assert.ok(csv.body.includes('"Ana Cliente"') && csv.body.includes('"78.50"') && csv.body.includes('"4.25"'));
    assert.ok(csv.body.includes(`"'=2+2"`), "la fórmula =2+2 debe quedar neutralizada con apóstrofo");
    assert.ok(!csv.body.includes(',"=2+2"'), "no debe haber ninguna celda que empiece por =");
    // rango inválido → se corrige, no se rompe
    await go(op, `/dashboard/${SLUG}/informes?desde=2026-02-31&hasta=hoy`);
    await waitText(op, "El rango de fechas no era válido");
  });

  await step("12. Roles: personal y administrador solo hacen lo que su rol permite (comprobado en el servidor)", async () => {
    const STAFF = { name: "Mozo Prueba", email: `mozo.${stamp}@prueba.pe`, password: "frase-larga-del-mozo-3" };
    const staffCtx = await browser.createBrowserContext();
    const sp = await newPage(staffCtx);
    await go(sp, "/registro");
    await fill(sp, "#name", STAFF.name);
    await fill(sp, "#email", STAFF.email);
    await fill(sp, "#password", STAFF.password);
    await submit(sp, "#password");
    await waitPath(sp, /^\/dashboard\/nuevo/);
    // sin ser miembro todavía: 404
    assert.equal(await status(sp, `/dashboard/${SLUG}/pedidos`), 404);
    // el dueño lo añade como PERSONAL
    await go(op, `/dashboard/${SLUG}/equipo`);
    await fill(op, "#team-email", "nadie.sin.cuenta@prueba.pe");
    await submit(op, "#team-email");
    await waitText(op, "todavía no tiene cuenta");
    await fill(op, "#team-email", STAFF.email);
    await submit(op, "#team-email");
    await waitText(op, "se unió al equipo");
    await snap(op, "equipo");
    // el personal solo ve Pedidos y Código QR
    await go(sp, `/dashboard/${SLUG}/pedidos`);
    const tabs = await sp.$$eval('nav[aria-label="Secciones del panel"] a', (els) => els.map((e) => e.textContent?.trim()));
    assert.deepEqual(tabs, ["Pedidos", "Código QR"]);
    for (const p of ["carta", "ajustes", "informes", "equipo"]) assert.equal(await status(sp, `/dashboard/${SLUG}/${p}`), 307, `el personal no debe abrir /${p}`);
    assert.equal(await status(sp, `/dashboard/${SLUG}/informes/csv?tipo=pedidos`), 403, "el personal no puede exportar CSV");
    assert.equal(await status(sp, `/dashboard/${SLUG}/qr/image?format=png`), 200, "el personal sí puede ver el QR");
    // y puede atender pedidos: un cliente hace el pedido #3 y el personal lo confirma
    const cp = await newPage(customer, 390, 844);
    await go(cp, `/r/${SLUG}`);
    await cp.click('[data-product="Ceviche clásico"] button[aria-label^="Agregar"]');
    await cp.click("[data-testid=open-cart]");
    await cp.evaluate(() => [...document.querySelectorAll<HTMLLabelElement>("label.tab")].find((l) => l.textContent?.trim() === "Recojo")?.click());
    await cp.type("#order-customerName", "Pedro Tres");
    await cp.type("#order-customerPhone", "999 333 333");
    await cp.click("[data-testid=send-order]");
    await waitText(cp, "Pedido #3");
    await cp.close();
    await go(sp, `/dashboard/${SLUG}/pedidos`);
    await sp.click("[data-order-number='3']");
    await waitText(sp, "Pedido #3");
    await sp.click('[data-status-action="confirmed"]');
    await waitBadge(sp, "Confirmado");
    // el dueño lo pasa a ADMINISTRADOR: ahora ve carta, informes y ajustes, pero no el equipo
    await go(op, `/dashboard/${SLUG}/equipo`);
    await op.evaluate((email) => {
      const li = document.querySelector(`[data-member="${email}"]`);
      [...(li?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes("Cambiar a administrador"))?.click();
    }, STAFF.email);
    await op.waitForFunction((email) => document.querySelector(`[data-member="${email}"]`)?.textContent?.includes("Administrador"), {}, STAFF.email);
    for (const p of ["carta", "ajustes", "informes"]) assert.equal(await status(sp, `/dashboard/${SLUG}/${p}`), 200, `el administrador debe abrir /${p}`);
    assert.equal(await status(sp, `/dashboard/${SLUG}/equipo`), 307, "el administrador no gestiona el equipo");
    assert.equal(await status(sp, `/dashboard/${SLUG}/informes/csv?tipo=pedidos`), 200);
    // el dueño lo quita: pierde TODO el acceso de inmediato, aunque conserve la sesión
    await op.evaluate((email) => {
      const li = document.querySelector(`[data-member="${email}"]`);
      [...(li?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === "Quitar")?.click();
    }, STAFF.email);
    await op.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("Sí, eliminar")));
    await op.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Sí, eliminar"))?.click());
    await op.waitForFunction((email) => !document.querySelector(`[data-member="${email}"]`), {}, STAFF.email);
    for (const p of ["pedidos", "carta", "qr/image?format=png"]) assert.equal(await status(sp, `/dashboard/${SLUG}/${p}`), 404, `un ex-miembro no debe acceder a /${p}`);
    await staffCtx.close();
  });
  // ───────────── Acceso con Google (contra el «Google» local: ver mock-google.mts) ─────────────
  const probe = await fetch(`${BASE}/auth/google/start`, { redirect: "manual" });
  const googleReady = (probe.headers.get("location") ?? "").startsWith(`http://127.0.0.1:${MOCK_PORT}/authorize`);
  if (!googleReady || !googleSql) {
    console.log("\n  (pasos de Google omitidos: la app no está arrancada con el Google local; ver docs/ESTADO-APP.md)");
  } else {
    const P = (tag: string, over: Partial<Persona> = {}): Persona => ({ sub: `sub-${tag}-${stamp}`, email: `${tag}.${stamp}@gmail.test`, name: `Persona ${tag}`, emailVerified: true, ...over });
    const count = async (email: string) => Number((await googleSql`select count(*)::int as n from users where email = ${email}`)[0]?.n);
    /** Recorre el flujo SIN navegador: inicio → «Google» → URL de retorno. Devuelve la cookie del flujo y el retorno. */
    const flow = async (persona: Persona, next?: string) => {
      mock.setPersona(persona);
      const r1 = await fetch(`${BASE}/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`, { redirect: "manual" });
      const authUrl = r1.headers.get("location") ?? "";
      const r2 = await fetch(authUrl, { redirect: "manual" });
      return { cookie: r1.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), setCookie: r1.headers.getSetCookie(), authUrl, cb: r2.headers.get("location") ?? "" };
    };
    const callback = async (cb: string, cookie?: string) => {
      const r = await fetch(cb, { redirect: "manual", headers: cookie ? { cookie } : {} });
      return { status: r.status, location: r.headers.get("location") ?? "", cookies: r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
    };
    const SLUG_G = `google-${stamp}`;
    const G_NEW = P("nuevo");

    await step("13. Google: botón con logotipo en /registro y /login, separador y arranque del flujo real (PKCE, state, nonce)", async () => {
      const gp = await newPage(await browser.createBrowserContext());
      for (const [path, keep] of [["/registro", ["Crear cuenta", "Inicia sesión", "Tu nombre"]], ["/login", ["Iniciar sesión", "Regístrate gratis", "Correo"]]] as const) {
        await go(gp, path);
        await snap(gp, `google${path.replace("/", "-")}`);
        const info = await gp.evaluate(() => {
          const b = document.querySelector<HTMLAnchorElement>("[data-testid=google-button]");
          const form = document.querySelector("form");
          return {
            text: b?.innerText.trim(),
            href: b?.getAttribute("href"),
            colors: [...(b?.querySelectorAll("svg path") ?? [])].map((p) => p.getAttribute("fill")),
            sep: document.querySelector("[role=separator]")?.textContent?.trim(),
            aboveForm: !!b && !!form && !!(b.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING),
            body: document.body.innerText,
          };
        });
        assert.equal(info.text, "Continuar con Google");
        assert.equal(info.href, "/auth/google/start");
        assert.deepEqual(info.colors, ["#EA4335", "#4285F4", "#FBBC05", "#34A853"], "logotipo oficial de Google (4 colores)");
        assert.match(info.sep ?? "", /o con tu correo/i);
        assert.ok(info.aboveForm, "el botón debe ir ENCIMA del formulario");
        for (const k of keep) assert.ok(info.body.toLowerCase().includes(k.toLowerCase()), `falta «${k}» en ${path}`);
      }
      const r = await flow(P("ui"));
      const u = new URL(r.authUrl);
      assert.equal(u.origin, `http://127.0.0.1:${MOCK_PORT}`);
      const q = Object.fromEntries(u.searchParams);
      assert.equal(q.response_type, "code");
      assert.equal(q.scope, "openid email profile");
      assert.equal(q.code_challenge_method, "S256");
      assert.equal(q.code_challenge?.length, 43, "PKCE: challenge de SHA-256 en base64url");
      assert.ok((q.state?.length ?? 0) >= 40 && (q.nonce?.length ?? 0) >= 20, "state y nonce aleatorios");
      assert.equal(q.redirect_uri, `${BASE}/auth/google/callback`);
      assert.ok(!r.authUrl.includes("client_secret") && !r.authUrl.includes("test-client-secret"), "el secreto del cliente nunca viaja en la URL");
      assert.ok(!r.authUrl.includes("code_verifier"), "el verificador PKCE nunca viaja a Google en la URL");
      const c = r.setCookie.join(" | ");
      assert.match(c, /sb_oauth=/);
      assert.match(c, /HttpOnly/i);
      assert.match(c, /SameSite=Lax/i);
      assert.match(c, /Max-Age=600/i);
      assert.ok(!c.includes(q.nonce as string), "el nonce no se guarda en la cookie");
    });

    await step("14. Google: usuario NUEVO crea su cuenta sin contraseña, va a crear su restaurante y no ve datos ajenos", async () => {
      mock.setPersona(G_NEW);
      const gctx = await browser.createBrowserContext();
      const gp = await newPage(gctx);
      await go(gp, "/registro");
      const before = mock.log.authorize.length;
      // doble clic inmediato: el segundo se ignora (no se duplica el envío)
      await gp.evaluate(() => {
        const a = document.querySelector<HTMLAnchorElement>("[data-testid=google-button]");
        a?.click();
        a?.click();
      });
      await waitPath(gp, /^\/dashboard\/nuevo/);
      assert.equal(mock.log.authorize.length - before, 1, "un doble clic debe iniciar UN solo flujo");
      const tok = mock.log.token.at(-1);
      assert.ok(tok?.get("code_verifier") && tok.get("client_secret") === "test-client-secret" && tok.get("grant_type") === "authorization_code", "el intercambio usa PKCE y el secreto en el servidor");
      const cookies = await gp.cookies();
      const session = cookies.find((c) => c.name.endsWith("sb_session"));
      assert.ok(session?.httpOnly && session.sameSite === "Lax", "sesión HttpOnly/Lax: la MISMA cookie que usa el correo/contraseña");
      assert.ok(!cookies.some((c) => c.name.endsWith("sb_oauth")), "la cookie temporal del flujo se borra");
      const u = (await googleSql`select name, password_hash, email_verified_at, id from users where email = ${G_NEW.email}`)[0];
      assert.ok(u, "la cuenta debe existir");
      assert.equal(u.password_hash, null, "cuenta de Google sin contraseña");
      assert.ok(u.email_verified_at, "correo verificado");
      assert.equal(u.name, G_NEW.name);
      assert.equal(Number((await googleSql`select count(*)::int as n from memberships where user_id = ${u.id}`)[0]?.n), 0, "sin restaurantes ni permisos especiales");
      assert.equal(Number((await googleSql`select count(*)::int as n from oauth_identities where user_id = ${u.id} and provider = 'google' and subject = ${G_NEW.sub}`)[0]?.n), 1);
      await snap(gp, "google-nuevo-crear-restaurante");
      // crea su restaurante (flujo existente)
      await fill(gp, "#name", "Local de Google");
      await fill(gp, "#slug", SLUG_G);
      await submit(gp, "#name");
      await waitPath(gp, new RegExp(`^/dashboard/${SLUG_G}/carta`));
      // aislamiento: no ve nada del restaurante de otra persona
      for (const p of ["pedidos", "carta", "ajustes", "informes", "equipo", "qr/image?format=png"]) assert.equal(await status(gp, `/dashboard/${SLUG}/${p}`), 404, `un usuario de Google no debe acceder a /${p} de otro restaurante`);
      assert.equal(await status(gp, `/dashboard/${SLUG_G}/pedidos`), 200);
      (globalThis as Record<string, unknown>).__gctx = gctx;
    });

    await step("15. Google: el usuario existente vuelve al MISMO perfil y a su panel; sin contraseña no entra por correo", async () => {
      const gp = (await ((globalThis as Record<string, unknown>).__gctx as BrowserContext).pages())[0] as Page;
      await go(gp, `/dashboard/${SLUG_G}/carta`);
      await gp.click("header form button[type=submit]"); // cerrar sesión
      await waitPath(gp, /^\/$/);
      mock.setPersona(G_NEW);
      await go(gp, "/login");
      await gp.click("[data-testid=google-button]");
      await waitPath(gp, new RegExp(`^/dashboard/${SLUG_G}/pedidos`)); // con UN restaurante va directo a su panel
      assert.equal(await count(G_NEW.email), 1, "no se debe duplicar la cuenta");
      assert.equal(Number((await googleSql`select count(*)::int as n from oauth_identities where subject = ${G_NEW.sub}`)[0]?.n), 1);
      assert.ok((await text(gp)).includes("Local de Google"), "debe conservar su restaurante");
      await gp.click("header form button[type=submit]");
      await waitPath(gp, /^\/$/);
      await go(gp, "/login");
      await fill(gp, "#email", G_NEW.email);
      await fill(gp, "#password", "cualquier-clave-larga-123");
      await submit(gp, "#password");
      await waitText(gp, "Correo o contraseña incorrectos");
    });

    await step("16. Google: un correo que ya tiene cuenta con contraseña NO se vincula solo; exige la contraseña y no pierde su restaurante", async () => {
      const G_LINK = P("vinculo", { email: OWNER.email });
      mock.setPersona(G_LINK);
      const lctx = await browser.createBrowserContext();
      const lp = await newPage(lctx);
      await go(lp, "/login");
      await lp.click("[data-testid=google-button]");
      await waitPath(lp, /^\/login\/vincular/);
      await snap(lp, "google-vincular");
      assert.equal(await status(lp, "/dashboard"), 307, "todavía NO hay sesión");
      const t = await text(lp);
      assert.ok(t.includes(OWNER.email) && t.includes("confirma que es tuya"));
      assert.equal(await count(OWNER.email), 1, "no se creó una cuenta duplicada");
      const ownerId = (await googleSql`select id from users where email = ${OWNER.email}`)[0]?.id;
      const identities = async () => Number((await googleSql`select count(*)::int as n from oauth_identities where user_id = ${ownerId}`)[0]?.n);
      assert.equal(await identities(), 0, "no se vincula solo porque el correo coincida");
      // contraseña incorrecta: sigue sin vincular
      await fill(lp, "#password", "contrasena-incorrecta-1");
      await submit(lp, "#password");
      await waitText(lp, "Contraseña incorrecta");
      assert.equal(await identities(), 0);
      assert.equal(await status(lp, "/dashboard"), 307);
      // contraseña correcta: vincula, abre sesión y entra a SU panel con SU restaurante
      await fill(lp, "#password", OWNER.password);
      await submit(lp, "#password");
      await waitPath(lp, new RegExp(`^/dashboard/${SLUG}/pedidos`));
      assert.equal(await identities(), 1);
      assert.equal(await count(OWNER.email), 1);
      const t2 = await text(lp);
      assert.ok(t2.includes("La Mar E2E") && t2.includes("Ana Cliente"), "conserva restaurante y pedidos");
      assert.equal(await status(lp, `/dashboard/${SLUG}/ajustes`), 200, "sigue siendo propietario");
      assert.equal(await status(lp, `/dashboard/${SLUG_G}/pedidos`), 404, "y no ve el restaurante de otra persona");
      // el enlace ya no es reutilizable; a partir de ahora entra directo con Google y la contraseña sigue valiendo
      assert.equal(await status(lp, "/login/vincular"), 307);
      await lp.click("header form button[type=submit]");
      await waitPath(lp, /^\/$/);
      await go(lp, "/login");
      await lp.click("[data-testid=google-button]");
      await waitPath(lp, new RegExp(`^/dashboard/${SLUG}/pedidos`));
      await lp.click("header form button[type=submit]");
      await waitPath(lp, /^\/$/);
      await go(lp, "/login");
      await fill(lp, "#email", OWNER.email);
      await fill(lp, "#password", OWNER.password);
      await submit(lp, "#password");
      await waitPath(lp, /^\/dashboard/);
      assert.ok(!/login/.test(lp.url()));
    });

    await step("17. Google: ataques y errores del callback (state manipulado/repetido, otro navegador, correo sin verificar, nonce ajeno, cancelar, redirección abierta)", async () => {
      // callback directo, sin haber empezado el flujo
      const none = await callback(`${BASE}/auth/google/callback?code=x&state=${"a".repeat(43)}`);
      assert.match(none.location, /\/login\?error=google_estado$/);
      // flujo correcto → sesión VÁLIDA; repetir el mismo retorno falla (state de un solo uso)
      const ok1 = await flow(P("replay"));
      const done = await callback(ok1.cb, ok1.cookie);
      assert.equal(done.status, 303);
      assert.ok(done.location.endsWith("/dashboard/nuevo"), `usuario nuevo → crear restaurante (fue ${done.location})`);
      const sess = done.cookies.split("; ").find((c) => c.includes("sb_session"));
      assert.ok(sess, "el callback debe emitir la cookie de sesión");
      assert.equal((await fetch(`${BASE}/dashboard/nuevo`, { redirect: "manual", headers: { cookie: sess } })).status, 200, "la sesión del callback es válida en el servidor");
      assert.match((await callback(ok1.cb, ok1.cookie)).location, /\/login\?error=google_estado$/, "repetición del mismo retorno");
      // state manipulado
      const f2 = await flow(P("tamper"));
      const tampered = new URL(f2.cb);
      tampered.searchParams.set("state", "b".repeat(43));
      assert.match((await callback(tampered.toString(), f2.cookie)).location, /error=google_estado$/);
      // retorno de otro flujo con la cookie de este (login CSRF)
      const fa = await flow(P("csrfa"));
      const fb = await flow(P("csrfb"));
      assert.match((await callback(fb.cb, fa.cookie)).location, /error=google_estado$/);
      // sin cookie (otro navegador)
      const f3 = await flow(P("sincookie"));
      assert.match((await callback(f3.cb)).location, /error=google_estado$/);
      assert.equal(await count(P("sincookie").email), 0);
      // correo NO verificado por Google
      const unv = P("sinverificar", { emailVerified: false });
      const fu = await flow(unv);
      assert.match((await callback(fu.cb, fu.cookie)).location, /error=google_correo_no_verificado$/);
      assert.equal(await count(unv.email), 0, "no se crea cuenta con correo sin verificar");
      // id_token de otro flujo (nonce distinto)
      const bn = P("nonce", { badNonce: true });
      const fn = await flow(bn);
      assert.match((await callback(fn.cb, fn.cookie)).location, /error=google_fallo$/);
      assert.equal(await count(bn.email), 0);
      // el usuario cancela en Google
      const fd = await flow(P("cancela", { deny: true }));
      assert.match(fd.cb, /error=access_denied/);
      assert.match((await callback(fd.cb, fd.cookie)).location, /error=google_cancelado$/);
      // redirección abierta: next externo se ignora; next interno válido se respeta
      const evil = await flow(G_NEW, "https://malo.com/robo");
      const lo = (await callback(evil.cb, evil.cookie)).location;
      assert.ok(lo.startsWith(BASE) && !lo.includes("malo.com"), `no debe redirigir fuera del sitio (fue ${lo})`);
      const deep = await flow(G_NEW, `/dashboard/${SLUG_G}/qr`);
      assert.equal((await callback(deep.cb, deep.cookie)).location, `${BASE}/dashboard/${SLUG_G}/qr`);
      const sneaky = await flow(G_NEW, "//malo.com");
      assert.ok(!(await callback(sneaky.cb, sneaky.cookie)).location.includes("malo.com"));
      // la página de errores muestra mensajes claros (no técnicos)
      const ep = await newPage(await browser.createBrowserContext());
      for (const [code, msg] of [["google_cancelado", "Cancelaste"], ["google_estado", "caducó"], ["google_correo_no_verificado", "verificado"], ["google_fallo", "No se pudo completar"]] as const) {
        await go(ep, `/login?error=${code}`);
        assert.ok((await text(ep)).includes(msg), `mensaje de ${code}`);
      }
      await go(ep, "/registro?error=google_cancelado");
      assert.ok((await text(ep)).includes("Cancelaste"));
      await snap(ep, "google-error");
    });
  }
} catch {
  process.exitCode = 1;
} finally {
  await browser.close();
  await mock.stop();
  await googleSql?.end({ timeout: 5 });
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pasos correctos${failed.length ? ` — FALLÓ: ${failed.map((f) => f.step).join("; ")}` : ""}\n`);
}
