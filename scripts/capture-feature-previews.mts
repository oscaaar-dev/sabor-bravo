import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer-core";
import sharp from "sharp";

const base = process.env.CAPTURE_BASE ?? "http://localhost:3001";
const email = process.env.CAPTURE_EMAIL;
const password = process.env.CAPTURE_PASSWORD;
const slug = process.env.CAPTURE_SLUG;
const teamEmail = process.env.CAPTURE_TEAM_EMAIL;
const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const output = path.resolve(process.env.CAPTURE_OUT ?? "public/images/features");

assert.ok(email, "Falta CAPTURE_EMAIL");
assert.ok(password, "Falta CAPTURE_PASSWORD");
assert.ok(slug, "Falta CAPTURE_SLUG");

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
page.setDefaultTimeout(20_000);
await mkdir(output, { recursive: true });

async function go(url: string) {
  await page.goto(`${base}${url}`, { waitUntil: "networkidle2" });
}

async function shot(selector: string, name: string, position: sharp.Gravity | sharp.Strategy = "north") {
  const element = await page.$(selector);
  assert.ok(element, `No existe ${selector} para ${name}`);
  const temporary = path.join(output, `${name}.source.png`);
  await element.screenshot({ path: temporary });
  await sharp(temporary)
    .resize(960, 360, { fit: "cover", position })
    .webp({ quality: 88, effort: 5 })
    .toFile(path.join(output, `${name}.webp`));
  await rm(temporary);
  console.log(`✓ ${name}.webp`);
}

try {
  await go("/login");
  await page.type("#email", email);
  await page.type("#password", password);
  const button = await page.$("#password");
  const submit = await button?.evaluateHandle((input) => input.form?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? null);
  const submitElement = submit?.asElement();
  assert.ok(submitElement, "No se encontró el botón de acceso");
  await submitElement.click();
  await page.waitForFunction(() => location.pathname.startsWith("/dashboard"));

  await go(`/dashboard/${slug}/qr`);
  await page.waitForSelector('[data-testid="qr-image"]');
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>('[data-testid="qr-image"]');
    return Boolean(image?.complete && image.naturalWidth > 0);
  });
  await shot("main", "qr-real", "north");

  await go(`/dashboard/${slug}/carta`);
  await shot('[data-category="Entradas"]', "catalog-real", "north");
  await shot('[data-product="Chicha morada"]', "promo-real", "west");

  await go(`/r/${slug}`);
  await page.click('[data-product="Chicha morada"] button[aria-label^="Agregar"]');
  await page.click('[data-testid="open-cart"]');
  await page.waitForSelector('[role="dialog"]');
  await shot('[role="dialog"]', "cart-real", "north");

  await go(`/dashboard/${slug}/pedidos`);
  await shot("main", "service-real", "north");

  await go(`/dashboard/${slug}/informes`);
  await shot("main", "reports-real", "north");

  await go(`/dashboard/${slug}/equipo`);
  if (teamEmail && !(await page.$(`[data-member="${teamEmail}"]`))) {
    await page.type("#team-email", teamEmail);
    const teamField = await page.$("#team-email");
    const teamSubmit = await teamField?.evaluateHandle((input) => input.form?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? null);
    const teamSubmitElement = teamSubmit?.asElement();
    assert.ok(teamSubmitElement, "No se encontró el botón para añadir al equipo");
    await teamSubmitElement.click();
    await page.waitForSelector(`[data-member="${teamEmail}"]`);
  }
  await shot('[aria-labelledby="miembros"]', "team-real", "west");
} finally {
  await browser.close();
}
