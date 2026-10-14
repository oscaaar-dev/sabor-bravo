import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { inject } from "vitest";
import { createDb, type Db } from "@/server/db";
import { registerUser } from "@/server/domain/users";
import { createBusiness } from "@/server/domain/businesses";
import { createCategory, createProduct } from "@/server/domain/catalog";
import type { BusinessInput, ProductInput } from "@/lib/validation";

export interface TestDb {
  readonly db: Db;
  readonly url: string;
  /** Conexión SQL directa (para comprobar restricciones de la base saltándose la aplicación). */
  readonly sql: postgres.Sql;
  close(): Promise<void>;
}

/** Clona la base plantilla en una base nueva y devuelve una conexión a ella. */
export async function createTestDb(): Promise<TestDb> {
  const port = inject("pgPort");
  const name = `t_${randomBytes(6).toString("hex")}`;
  const admin = postgres(`postgres://postgres:postgres@127.0.0.1:${port}/postgres`, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name} template sb_template`);
  await admin.end();
  const url = `postgres://postgres:postgres@127.0.0.1:${port}/${name}`;
  const { db, close } = createDb(url, { max: 10 });
  const sql = postgres(url, { max: 3, onnotice: () => {} });
  return {
    db,
    url,
    sql,
    async close() {
      await close();
      await sql.end({ timeout: 5 });
    },
  };
}

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function makeUser(db: Db, name = "Dueña Prueba") {
  const email = `u${uniq()}@prueba.pe`;
  const r = await registerUser(db, { name, email, password: "una-clave-larga-123" });
  if (!r.ok) throw new Error(`no se pudo crear el usuario de prueba: ${r.message}`);
  return r.data;
}

export const businessInput = (over: Partial<BusinessInput> = {}): BusinessInput => ({
  name: "La Mar de Prueba",
  slug: `local-${uniq()}`,
  description: null,
  phone: null,
  address: null,
  acceptsDineIn: true,
  acceptsPickup: true,
  acceptsDelivery: true,
  deliveryFee: 500,
  isPublished: true,
  ...over,
});

export async function makeBusiness(db: Db, userId: string, over: Partial<BusinessInput> = {}) {
  const r = await createBusiness(db, userId, businessInput(over));
  if (!r.ok) throw new Error(`no se pudo crear el restaurante de prueba: ${r.message}`);
  return r.data;
}

export const productInput = (categoryId: string, over: Partial<ProductInput> = {}): ProductInput => ({
  categoryId,
  name: "Ceviche clásico",
  description: null,
  price: 3500,
  imageUrl: null,
  isAvailable: true,
  isPublished: true,
  promoPercent: null,
  promoEndsAt: null,
  ...over,
});

/** Restaurante con una categoría y dos platos listos para pedir. */
export async function makeMenu(db: Db, businessId: string) {
  const cat = await createCategory(db, businessId, "Entradas");
  if (!cat.ok) throw new Error(cat.message);
  const a = await createProduct(db, businessId, productInput(cat.data.id, { name: "Ceviche clásico", price: 3500 }));
  const b = await createProduct(db, businessId, productInput(cat.data.id, { name: "Chicha morada", price: 800 }));
  if (!a.ok || !b.ok) throw new Error("no se pudieron crear los platos de prueba");
  return { category: cat.data, ceviche: a.data, chicha: b.data };
}
