import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { categories, products } from "@/server/db/schema";
import type { ProductInput } from "@/lib/validation";
import { fail, ok, pgError, type Result } from "./result";

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export interface CategoryWithProducts extends Category {
  readonly products: Product[];
}

const FOREIGN_KEY_VIOLATION = "23503";

function group(cats: Category[], prods: Product[]): CategoryWithProducts[] {
  return cats.map((c) => ({ ...c, products: prods.filter((p) => p.categoryId === c.id) }));
}

/** Carta completa para el panel (incluye platos no publicados o agotados). */
export async function listCatalog(db: Db, businessId: string): Promise<CategoryWithProducts[]> {
  const [cats, prods] = await Promise.all([
    db.select().from(categories).where(eq(categories.businessId, businessId)).orderBy(asc(categories.position), asc(categories.createdAt)),
    db.select().from(products).where(eq(products.businessId, businessId)).orderBy(asc(products.position), asc(products.createdAt)),
  ]);
  return group(cats, prods);
}

/** Carta pública: SOLO platos publicados y disponibles; las categorías vacías no se muestran. */
export async function getPublicMenu(db: Db, businessId: string): Promise<CategoryWithProducts[]> {
  const [cats, prods] = await Promise.all([
    db.select().from(categories).where(eq(categories.businessId, businessId)).orderBy(asc(categories.position), asc(categories.createdAt)),
    db
      .select()
      .from(products)
      .where(and(eq(products.businessId, businessId), eq(products.isPublished, true), eq(products.isAvailable, true)))
      .orderBy(asc(products.position), asc(products.createdAt)),
  ]);
  return group(cats, prods).filter((c) => c.products.length > 0);
}

export async function createCategory(db: Db, businessId: string, name: string): Promise<Result<Category>> {
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${categories.position}), 0) + 1` })
    .from(categories)
    .where(eq(categories.businessId, businessId));
  const rows = await db.insert(categories).values({ businessId, name, position: next }).returning();
  const row = rows[0];
  return row ? ok(row) : fail("No se pudo crear la categoría.");
}

export async function renameCategory(db: Db, businessId: string, id: string, name: string): Promise<Result<Category>> {
  const rows = await db.update(categories).set({ name }).where(and(eq(categories.id, id), eq(categories.businessId, businessId))).returning();
  const row = rows[0];
  return row ? ok(row) : fail("Categoría no encontrada.");
}

/** Borra la categoría y, por la clave foránea, sus platos. Las líneas de pedidos antiguos conservan nombre y precio. */
export async function deleteCategory(db: Db, businessId: string, id: string): Promise<Result<{ productsRemoved: number }>> {
  return db.transaction(async (tx) => {
    const [{ n } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.categoryId, id), eq(products.businessId, businessId)));
    const rows = await tx.delete(categories).where(and(eq(categories.id, id), eq(categories.businessId, businessId))).returning({ id: categories.id });
    return rows.length === 1 ? ok({ productsRemoved: n }) : fail("Categoría no encontrada.");
  });
}

export async function createProduct(db: Db, businessId: string, input: ProductInput): Promise<Result<Product>> {
  try {
    const [{ next } = { next: 0 }] = await db
      .select({ next: sql<number>`coalesce(max(${products.position}), 0) + 1` })
      .from(products)
      .where(and(eq(products.businessId, businessId), eq(products.categoryId, input.categoryId)));
    const rows = await db
      .insert(products)
      .values({
        businessId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        priceCents: input.price,
        imageUrl: input.imageUrl,
        isAvailable: input.isAvailable,
        isPublished: input.isPublished,
        promoPercent: input.promoPercent,
        promoEndsAt: input.promoEndsAt,
        position: next,
      })
      .returning();
    const row = rows[0];
    return row ? ok(row) : fail("No se pudo crear el plato.");
  } catch (e) {
    // clave foránea compuesta (category_id, business_id): la categoría no es de este restaurante
    if (pgError(e).code === FOREIGN_KEY_VIOLATION) return fail("La categoría elegida no es válida.", { fieldErrors: { categoryId: ["Elige una categoría de tu carta"] } });
    throw e;
  }
}

export async function updateProduct(db: Db, businessId: string, id: string, input: ProductInput): Promise<Result<Product>> {
  try {
    const rows = await db
      .update(products)
      .set({
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        priceCents: input.price,
        imageUrl: input.imageUrl,
        isAvailable: input.isAvailable,
        isPublished: input.isPublished,
        promoPercent: input.promoPercent,
        promoEndsAt: input.promoEndsAt,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.businessId, businessId)))
      .returning();
    const row = rows[0];
    return row ? ok(row) : fail("Plato no encontrado.");
  } catch (e) {
    if (pgError(e).code === FOREIGN_KEY_VIOLATION) return fail("La categoría elegida no es válida.", { fieldErrors: { categoryId: ["Elige una categoría de tu carta"] } });
    throw e;
  }
}

export async function setProductAvailability(db: Db, businessId: string, id: string, isAvailable: boolean): Promise<Result<Product>> {
  const rows = await db
    .update(products)
    .set({ isAvailable, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.businessId, businessId)))
    .returning();
  const row = rows[0];
  return row ? ok(row) : fail("Plato no encontrado.");
}

export async function deleteProduct(db: Db, businessId: string, id: string): Promise<Result<null>> {
  const rows = await db.delete(products).where(and(eq(products.id, id), eq(products.businessId, businessId))).returning({ id: products.id });
  return rows.length === 1 ? ok(null) : fail("Plato no encontrado.");
}
