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
} catch {
  process.exitCode = 1;
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pasos correctos${failed.length ? ` — FALLÓ: ${failed.map((f) => f.step).join("; ")}` : ""}\n`);
}
