import { bigint, boolean, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Espejo TIPADO de db/migrations/*.sql (la fuente de verdad del esquema son las migraciones SQL, con sus
 * restricciones y claves foráneas compuestas). Si cambias una, cambia la otra; los tests de integración
 * ejecutan consultas reales contra el esquema SQL y detectan cualquier desajuste.
 */
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
});

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  phone: text("phone"),
  address: text("address"),
  acceptsDineIn: boolean("accepts_dine_in").notNull().default(true),
  acceptsPickup: boolean("accepts_pickup").notNull().default(true),
  acceptsDelivery: boolean("accepts_delivery").notNull().default(false),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  nextOrderNumber: integer("next_order_number").notNull().default(1),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id").notNull(),
    businessId: uuid("business_id").notNull(),
    role: text("role").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.businessId] })],
);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull(),
  categoryId: uuid("category_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").notNull().default(true),
  isPublished: boolean("is_published").notNull().default(true),
  promoPercent: integer("promo_percent"),
  promoEndsAt: ts("promo_ends_at"),
  position: integer("position").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull(),
  number: integer("number").notNull(),
  orderType: text("order_type").notNull(),
  tableLabel: text("table_label"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  deliveryAddress: text("delivery_address"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  subtotalCents: integer("subtotal_cents").notNull(),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  idempotencyKey: text("idempotency_key"),
  publicToken: text("public_token").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull(),
  businessId: uuid("business_id").notNull(),
  productId: uuid("product_id"),
  productName: text("product_name").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  /** Precio de lista antes de la promoción (null si no había promoción vigente). */
  listPriceCents: integer("list_price_cents"),
  quantity: integer("quantity").notNull(),
  lineTotalCents: integer("line_total_cents").notNull(),
});

export const orderEvents = pgTable("order_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  orderId: uuid("order_id").notNull(),
  businessId: uuid("business_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actorUserId: uuid("actor_user_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull().defaultNow(),
  hits: integer("hits").notNull().default(0),
});
