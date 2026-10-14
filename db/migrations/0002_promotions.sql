-- Promociones: descuento porcentual por plato, con fecha de fin opcional (hasta el final de ese día, hora de Lima).
-- El servidor aplica la promoción VIGENTE al calcular el pedido y guarda en cada línea el precio de lista original,
-- para que los informes puedan mostrar cuánto se descontó.

alter table products
  add column promo_percent integer,
  add column promo_ends_at timestamptz,
  add constraint products_promo_percent check (promo_percent is null or promo_percent between 1 and 90),
  add constraint products_promo_ends check (promo_ends_at is null or promo_percent is not null);

alter table order_items
  add column list_price_cents integer,
  add constraint order_items_list_price check (list_price_cents is null or list_price_cents >= unit_price_cents);
