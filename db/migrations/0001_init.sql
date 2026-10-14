-- SABOR BRAVO — esquema inicial (PostgreSQL 15+; probado en 17).
-- Multiempresa: TODA tabla de negocio lleva business_id y las relaciones hijas usan CLAVES FORÁNEAS COMPUESTAS
-- (id, business_id), así la propia base de datos impide enlazar un pedido, plato o línea con datos de OTRO restaurante.
-- Importes en céntimos (enteros, soles peruanos). Sin extensiones: solo funciones nativas.

-- ───────────────────────── Usuarios y sesiones ─────────────────────────
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text not null,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  constraint users_email_lowercase check (email = lower(email)),
  constraint users_email_len check (char_length(email) between 3 and 254),
  constraint users_name_len check (char_length(name) between 2 and 80)
);
create unique index users_email_key on users (email);

-- La cookie lleva un token aleatorio de 256 bits; aquí solo se guarda su SHA-256.
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index sessions_user_idx on sessions (user_id);
create index sessions_expires_idx on sessions (expires_at);

-- ───────────────────────── Restaurantes y pertenencia ─────────────────────────
create table businesses (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null,
  name               text not null,
  description        text,
  phone              text,
  address            text,
  accepts_dine_in    boolean not null default true,
  accepts_pickup     boolean not null default true,
  accepts_delivery   boolean not null default false,
  delivery_fee_cents integer not null default 0,
  is_published       boolean not null default true,
  next_order_number  integer not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  constraint businesses_name_len check (char_length(name) between 2 and 80),
  constraint businesses_description_len check (description is null or char_length(description) <= 300),
  constraint businesses_phone_len check (phone is null or char_length(phone) <= 30),
  constraint businesses_address_len check (address is null or char_length(address) <= 160),
  constraint businesses_delivery_fee check (delivery_fee_cents between 0 and 100000),
  constraint businesses_next_number check (next_order_number >= 1)
);
create unique index businesses_slug_key on businesses (slug);

create table memberships (
  user_id     uuid not null references users (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  role        text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, business_id),
  constraint memberships_role check (role in ('owner', 'admin', 'staff'))
);
create index memberships_business_idx on memberships (business_id);

-- ───────────────────────── Carta ─────────────────────────
create table categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint categories_name_len check (char_length(name) between 1 and 60),
  constraint categories_id_business_key unique (id, business_id)
);
create index categories_business_idx on categories (business_id, position);

create table products (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses (id) on delete cascade,
  category_id  uuid not null,
  name         text not null,
  description  text,
  price_cents  integer not null,
  image_url    text,
  is_available boolean not null default true,
  is_published boolean not null default true,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint products_name_len check (char_length(name) between 1 and 100),
  constraint products_description_len check (description is null or char_length(description) <= 400),
  constraint products_price check (price_cents between 0 and 10000000),
  constraint products_image_url check (image_url is null or (char_length(image_url) <= 500 and image_url ~ '^(https://|/)')),
  constraint products_id_business_key unique (id, business_id),
  -- la categoría debe ser del MISMO restaurante
  constraint products_category_fk foreign key (category_id, business_id)
    references categories (id, business_id) on delete cascade
);
create index products_business_idx on products (business_id, category_id, position);

-- ───────────────────────── Pedidos ─────────────────────────
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses (id) on delete cascade,
  number             integer not null,
  order_type         text not null,
  table_label        text,
  customer_name      text not null,
  customer_phone     text not null,
  delivery_address   text,
  notes              text,
  status             text not null default 'pending',
  subtotal_cents     integer not null,
  delivery_fee_cents integer not null default 0,
  total_cents        integer not null,
  idempotency_key    text,
  public_token       text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint orders_type check (order_type in ('dine_in', 'pickup', 'delivery')),
  constraint orders_status check (status in ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  constraint orders_amounts check (subtotal_cents >= 0 and delivery_fee_cents >= 0 and total_cents = subtotal_cents + delivery_fee_cents),
  constraint orders_table_required check (order_type <> 'dine_in' or (table_label is not null and char_length(table_label) between 1 and 20)),
  constraint orders_address_required check (order_type <> 'delivery' or (delivery_address is not null and char_length(delivery_address) between 5 and 200)),
  constraint orders_customer_name_len check (char_length(customer_name) between 2 and 80),
  constraint orders_customer_phone_len check (char_length(customer_phone) between 5 and 30),
  constraint orders_notes_len check (notes is null or char_length(notes) <= 300),
  constraint orders_number_key unique (business_id, number),
  constraint orders_idempotency_key unique (business_id, idempotency_key),
  constraint orders_token_key unique (public_token),
  constraint orders_id_business_key unique (id, business_id)
);
create index orders_business_status_idx on orders (business_id, status, created_at desc);
create index orders_business_created_idx on orders (business_id, created_at desc);

create table order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null,
  business_id      uuid not null,
  product_id       uuid,
  product_name     text not null,
  unit_price_cents integer not null,
  quantity         integer not null,
  line_total_cents integer not null,
  constraint order_items_quantity check (quantity between 1 and 99),
  constraint order_items_price check (unit_price_cents >= 0),
  constraint order_items_total check (line_total_cents = unit_price_cents * quantity),
  constraint order_items_order_fk foreign key (order_id, business_id)
    references orders (id, business_id) on delete cascade,
  -- si se borra el plato, la línea conserva su nombre y precio (snapshot) y solo pierde el enlace
  constraint order_items_product_fk foreign key (product_id, business_id)
    references products (id, business_id) on delete set null (product_id)
);
create index order_items_order_idx on order_items (order_id);
create index order_items_product_idx on order_items (business_id, product_id);

-- Historial de estados (auditoría): quién cambió qué y cuándo.
create table order_events (
  id            bigint generated always as identity primary key,
  order_id      uuid not null,
  business_id   uuid not null,
  from_status   text,
  to_status     text not null,
  actor_user_id uuid references users (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint order_events_order_fk foreign key (order_id, business_id)
    references orders (id, business_id) on delete cascade
);
create index order_events_order_idx on order_events (order_id, created_at);

-- ───────────────────────── Límite de intentos ─────────────────────────
create table rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);
create index rate_limits_window_idx on rate_limits (window_start);
