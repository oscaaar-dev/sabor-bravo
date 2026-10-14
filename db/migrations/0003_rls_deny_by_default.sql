-- Defensa en profundidad: RLS activado en TODAS las tablas y SIN políticas = ningún rol "anon" ni "authenticated" de Supabase
-- puede leer ni escribir nada por la API pública (PostgREST), aunque alguien la activara en el futuro.
-- La aplicación se conecta como PROPIETARIA de las tablas (rol postgres), que no se ve afectada por RLS: el aislamiento
-- entre restaurantes lo siguen garantizando las consultas filtradas por business_id y las claves foráneas compuestas.

alter table users enable row level security;
alter table sessions enable row level security;
alter table businesses enable row level security;
alter table memberships enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_events enable row level security;
alter table rate_limits enable row level security;
alter table schema_migrations enable row level security;
