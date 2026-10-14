-- Acceso con Google (OpenID Connect), reutilizando las cuentas y sesiones existentes.
--  · users.password_hash pasa a ser opcional: una cuenta creada con Google no tiene contraseña.
--  · users.email_verified_at: cuándo se comprobó que la persona controla ese correo (Google lo garantiza).
--  · oauth_identities: enlace (proveedor, id estable del proveedor "sub") → cuenta. El enlace se hace por el "sub", NUNCA por coincidencia de correo.
--  · oauth_states: estado de un flujo en curso (verificador PKCE, nonce, destino). Un solo uso, caduca a los 10 minutos.
--  · oauth_pending_links: cuando el correo de Google coincide con una cuenta con contraseña, el enlace queda PENDIENTE hasta que
--    la persona demuestre que es dueña de esa cuenta escribiendo su contraseña.

alter table users alter column password_hash drop not null;
alter table users add column email_verified_at timestamptz;
alter table users add constraint users_password_hash_format check (password_hash is null or password_hash like 'scrypt$%');

create table oauth_identities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  provider      text not null,
  subject       text not null,
  email         text not null,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  constraint oauth_identities_provider check (provider in ('google')),
  constraint oauth_identities_subject_len check (char_length(subject) between 1 and 255),
  constraint oauth_identities_provider_subject_key unique (provider, subject),
  -- una cuenta solo puede tener UNA identidad por proveedor
  constraint oauth_identities_user_provider_key unique (user_id, provider)
);
create index oauth_identities_user_idx on oauth_identities (user_id);

create table oauth_states (
  state_hash    text primary key,
  code_verifier text not null,
  nonce         text not null,
  next_path     text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);
create index oauth_states_expires_idx on oauth_states (expires_at);

create table oauth_pending_links (
  token_hash text primary key,
  user_id    uuid not null references users (id) on delete cascade,
  provider   text not null,
  subject    text not null,
  email      text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint oauth_pending_provider check (provider in ('google'))
);
create index oauth_pending_user_idx on oauth_pending_links (user_id);
create index oauth_pending_expires_idx on oauth_pending_links (expires_at);

-- Misma política que el resto: RLS activado y sin políticas (deny-by-default para la API pública de Supabase).
alter table oauth_identities enable row level security;
alter table oauth_states enable row level security;
alter table oauth_pending_links enable row level security;
