"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { placeOrderAction } from "@/app/actions/orders";
import type { FieldErrors } from "@/lib/validation";
import { formatPEN } from "@/lib/money";
import { TYPE_LABEL, type OrderType } from "@/lib/order-status";

export interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  /** Precio vigente (con la promoción aplicada). El importe final lo vuelve a calcular el servidor. */
  priceCents: number;
  /** Precio de lista tachado cuando hay promoción vigente. */
  listPriceCents: number | null;
  imageUrl: string | null;
}
export interface MenuCategory {
  id: string;
  name: string;
  products: MenuProduct[];
}
export interface MenuBusiness {
  slug: string;
  name: string;
  acceptsDineIn: boolean;
  acceptsPickup: boolean;
  acceptsDelivery: boolean;
  deliveryFeeCents: number;
}

type Cart = Record<string, number>;
const MAX_QTY = 99;

/**
 * Almacén externo del carrito (localStorage con copia en memoria): sobrevive a recargas y, si el navegador bloquea el
 * almacenamiento, el carrito sigue funcionando durante la visita. Se lee con useSyncExternalStore para no desajustar
 * el HTML del servidor (carrito vacío) con el del navegador.
 */
const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
function readStore(key: string): string {
  if (!memory.has(key)) {
    try {
      memory.set(key, window.localStorage.getItem(key) ?? "");
    } catch {
      memory.set(key, "");
    }
  }
  return memory.get(key) ?? "";
}
function writeStore(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento local: solo memoria */
  }
  listeners.get(key)?.forEach((l) => l());
}
function subscribeStore(key: string, cb: () => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(cb);
  listeners.set(key, set);
  return () => set.delete(cb);
}
function parseCart(raw: string, valid: Map<string, unknown>): Cart {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const clean: Cart = {};
    for (const [id, q] of Object.entries(parsed)) if (valid.has(id) && typeof q === "number" && Number.isInteger(q) && q > 0) clean[id] = Math.min(q, MAX_QTY);
    return clean;
  } catch {
    return {};
  }
}

export function MenuClient({ business, menu }: { business: MenuBusiness; menu: MenuCategory[] }) {
  const router = useRouter();
  const storageKey = `sb-cart:${business.slug}`;
  const products = useMemo(() => new Map(menu.flatMap((c) => c.products.map((p) => [p.id, p] as const))), [menu]);

  const types = useMemo(
    () => (["dine_in", "pickup", "delivery"] as OrderType[]).filter((t) => (t === "dine_in" ? business.acceptsDineIn : t === "pickup" ? business.acceptsPickup : business.acceptsDelivery)),
    [business],
  );

  const raw = useSyncExternalStore(
    (cb) => subscribeStore(storageKey, cb),
    () => readStore(storageKey),
    () => "",
  );
  const cart = useMemo(() => parseCart(raw, products), [raw, products]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<OrderType>(types[0] ?? "pickup");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Misma clave en reintentos de un envío cuyo resultado se desconoce (red caída): el servidor no duplica el pedido.
  const keyRef = useRef<string>("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setQty = useCallback(
    (id: string, qty: number) => {
      const next = { ...parseCart(readStore(storageKey), products) };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, MAX_QTY);
      writeStore(storageKey, JSON.stringify(next));
    },
    [storageKey, products],
  );

  const lines = Object.entries(cart).flatMap(([id, quantity]) => {
    const p = products.get(id);
    return p ? [{ p, quantity }] : [];
  });
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((n, l) => n + l.p.priceCents * l.quantity, 0);
  const fee = type === "delivery" ? business.deliveryFeeCents : 0;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending || lines.length === 0) return;
    const fd = new FormData(e.currentTarget);
    const text = (k: string) => String(fd.get(k) ?? "");
    setSending(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await placeOrderAction(business.slug, {
        type,
        tableLabel: text("tableLabel"),
        customerName: text("customerName"),
        customerPhone: text("customerPhone"),
        deliveryAddress: text("deliveryAddress"),
        notes: text("notes"),
        items: lines.map((l) => ({ productId: l.p.id, quantity: l.quantity })),
        idempotencyKey: (keyRef.current ||= crypto.randomUUID()),
      });
      if (res.ok) {
        writeStore(storageKey, "{}");
        keyRef.current = "";
        setOpen(false);
        router.push(`/r/${business.slug}/pedido/${res.token}`);
        return;
      }
      setError(res.message);
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      if (res.unavailableIds?.length) {
        const gone = new Set(res.unavailableIds);
        writeStore(storageKey, JSON.stringify(Object.fromEntries(Object.entries(cart).filter(([id]) => !gone.has(id)))));
      }
    } catch {
      setError("No se pudo enviar el pedido. Revisa tu conexión y vuelve a intentarlo: no se duplicará.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {menu.length > 1 ? (
        <nav aria-label="Categorías" className="sticky top-0 z-30 -mx-4 overflow-x-auto border-b-[3px] border-tinta bg-blanco px-4 py-2">
          <ul className="flex gap-2">
            {menu.map((c) => (
              <li key={c.id}>
                <a href={`#cat-${c.id}`} className="tab">
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="space-y-10 pb-32 pt-6">
        {menu.length === 0 ? (
          <p className="panel-brutal p-8 text-center text-lg font-bold">Este restaurante aún no tiene platos disponibles. Vuelve más tarde.</p>
        ) : null}
        {menu.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`h-${c.id}`} className="scroll-mt-16">
            <h2 id={`h-${c.id}`} className="h-display text-3xl">
              {c.name}
            </h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {c.products.map((p) => {
                const qty = cart[p.id] ?? 0;
                return (
                  <li key={p.id} className="panel-brutal flex gap-4 p-4" data-product={p.name}>
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" width={96} height={96} loading="lazy" referrerPolicy="no-referrer" className="size-24 shrink-0 border-[3px] border-tinta object-cover" />
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="text-lg font-extrabold leading-tight">{p.name}</h3>
                      {p.description ? <p className="mt-1 text-sm text-tinta-suave">{p.description}</p> : null}
                      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                        <span className="text-xl font-extrabold">
                          {p.listPriceCents ? (
                            <>
                              <s className="mr-2 text-base font-bold text-tinta-suave">{formatPEN(p.listPriceCents)}</s>
                              <span className="badge badge-coral mr-2 align-middle">Promo</span>
                            </>
                          ) : null}
                          {formatPEN(p.priceCents)}
                        </span>
                        {qty === 0 ? (
                          <button type="button" className="btn-brutal btn-coral btn-sm" onClick={() => setQty(p.id, 1)} aria-label={`Agregar ${p.name}`}>
                            Agregar
                          </button>
                        ) : (
                          <Stepper name={p.name} qty={qty} onChange={(q) => setQty(p.id, q)} />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {count > 0 && !open ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-tinta bg-blanco p-3">
          <button type="button" onClick={() => setOpen(true)} className="btn-brutal btn-petroleo mx-auto flex w-full max-w-2xl justify-between" data-testid="open-cart">
            <span>
              Ver mi pedido · {count} {count === 1 ? "producto" : "productos"}
            </span>
            <span>{formatPEN(subtotal)}</span>
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/60 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cart-title" tabIndex={-1} className="max-h-[92svh] w-full max-w-xl overflow-y-auto border-[3px] border-tinta bg-blanco p-5 shadow-brutal outline-none sm:rounded-[6px]">
            <div className="flex items-start justify-between gap-3">
              <h2 id="cart-title" className="h-display text-3xl">
                Tu pedido
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="btn-brutal btn-blanco btn-sm" aria-label="Cerrar">
                Cerrar
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="mt-4">Tu carrito está vacío.</p>
            ) : (
              <form onSubmit={submit} className="mt-4 space-y-5" noValidate>
                <ul className="divide-y-2 divide-tinta/15">
                  {lines.map(({ p, quantity }) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block font-extrabold">{p.name}</span>
                        <span className="text-sm text-tinta-suave">{formatPEN(p.priceCents)} c/u</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <Stepper name={p.name} qty={quantity} onChange={(q) => setQty(p.id, q)} />
                        <span className="w-20 text-right font-bold">{formatPEN(p.priceCents * quantity)}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <fieldset>
                  <legend className="field-label">¿Cómo quieres recibirlo?</legend>
                  <div className="flex flex-wrap gap-2">
                    {types.map((t) => (
                      <label key={t} className={`tab cursor-pointer ${type === t ? "!bg-petroleo !text-blanco" : ""}`}>
                        <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                        {TYPE_LABEL[t]}
                      </label>
                    ))}
                  </div>
                  {fieldErrors.type?.[0] ? <p className="field-error">{fieldErrors.type[0]}</p> : null}
                </fieldset>

                {type === "dine_in" ? <Input name="tableLabel" label="Número de mesa" errors={fieldErrors} required maxLength={20} /> : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input name="customerName" label="Tu nombre" errors={fieldErrors} required maxLength={80} autoComplete="name" />
                  <Input name="customerPhone" label="Tu teléfono" errors={fieldErrors} required maxLength={30} autoComplete="tel" inputMode="tel" />
                </div>
                {type === "delivery" ? <Input name="deliveryAddress" label="Dirección de entrega" errors={fieldErrors} required maxLength={200} autoComplete="street-address" /> : null}
                <Input name="notes" label="Notas para el restaurante (opcional)" errors={fieldErrors} maxLength={300} textarea />

                <dl className="space-y-1 border-t-[3px] border-tinta pt-3">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd>{formatPEN(subtotal)}</dd>
                  </div>
                  {fee > 0 ? (
                    <div className="flex justify-between">
                      <dt>Delivery</dt>
                      <dd>{formatPEN(fee)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-2xl font-extrabold">
                    <dt>Total</dt>
                    <dd data-testid="cart-total">{formatPEN(subtotal + fee)}</dd>
                  </div>
                </dl>
                <p className="text-sm text-tinta-suave">El restaurante confirmará tu pedido. El importe final lo calcula el servidor con los precios vigentes. Aquí no se paga online: pagas al recibirlo.</p>

                {error ? (
                  <p role="alert" className="alert alert-error">
                    {error}
                  </p>
                ) : null}

                <button type="submit" disabled={sending} aria-disabled={sending} className="btn-brutal btn-coral w-full" data-testid="send-order">
                  {sending ? "Enviando…" : "Enviar pedido"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Stepper({ name, qty, onChange }: { name: string; qty: number; onChange: (q: number) => void }) {
  return (
    <span className="inline-flex items-center border-[3px] border-tinta bg-blanco">
      <button type="button" className="grid size-9 place-items-center text-xl font-extrabold hover:bg-coral-claro" onClick={() => onChange(qty - 1)} aria-label={`Quitar una unidad de ${name}`}>
        −
      </button>
      <span className="min-w-8 text-center font-extrabold" aria-live="polite" aria-label={`${qty} de ${name}`}>
        {qty}
      </span>
      <button type="button" className="grid size-9 place-items-center text-xl font-extrabold hover:bg-coral-claro disabled:opacity-40" onClick={() => onChange(qty + 1)} disabled={qty >= MAX_QTY} aria-label={`Añadir una unidad de ${name}`}>
        +
      </button>
    </span>
  );
}

function Input({ name, label, errors, required, maxLength, autoComplete, inputMode, textarea }: { name: string; label: string; errors: FieldErrors; required?: boolean; maxLength?: number; autoComplete?: string; inputMode?: "tel"; textarea?: boolean }) {
  const err = errors[name]?.[0];
  const common = { id: `order-${name}`, name, required, maxLength, autoComplete, inputMode, className: "input", "aria-invalid": err ? (true as const) : undefined, "aria-describedby": err ? `order-${name}-err` : undefined };
  return (
    <div>
      <label htmlFor={`order-${name}`} className="field-label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {textarea ? <textarea {...common} rows={2} /> : <input {...common} type="text" />}
      {err ? (
        <p id={`order-${name}-err`} className="field-error" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
