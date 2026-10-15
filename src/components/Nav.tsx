"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LOGIN_HREF, NAV_LINKS, SIGNUP_HREF } from "@/content/nav";

/**
 * En escritorio, sobre el hero la barra es transparente y SIN logo: el fondo oficial
 * ya lleva el logo impreso arriba a la izquierda. Al hacer scroll aparece la barra
 * sólida con el logo compacto. En móvil la barra es siempre sólida y lleva el logo.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200 ${
        solid
          ? "border-tinta/10 bg-papel/95 backdrop-blur-md"
          : "border-transparent bg-papel wide:bg-transparent"
      }`}
    >
      <div className="container-sb flex h-[var(--nav-h)] items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="Sabor Bravo, ir al inicio"
          className={`shrink-0 ${solid ? "" : "wide:invisible"}`}
        >
          <Image
            src="/images/brands/sabor-bravo-compacto.png"
            alt="Sabor Bravo"
            width={190}
            height={90}
            className="h-10 w-auto"
            priority
          />
        </Link>

        <nav aria-label="Principal" className="ml-auto mr-5 hidden items-center gap-5 whitespace-nowrap xl:mr-8 xl:gap-7 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-xs font-bold text-tinta-suave transition-colors hover:text-petroleo xl:text-sm"
            >
              {l.short ? (
                <>
                  <span className="xl:hidden">{l.short}</span>
                  <span className="hidden xl:inline">{l.label}</span>
                </>
              ) : (
                l.label
              )}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 whitespace-nowrap lg:flex">
          <Link href={LOGIN_HREF} className="site-btn site-btn-secondary !min-h-10 !px-4 !text-sm">
            Iniciar sesión
          </Link>
          <Link href={SIGNUP_HREF} className="site-btn site-btn-primary !min-h-10 !px-4 !text-sm">
            Crear cuenta
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="site-btn site-btn-secondary !min-h-10 !px-4 !text-sm lg:hidden"
          aria-expanded={open}
          aria-controls="menu-movil"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Cerrar" : "Menú"}
        </button>
      </div>

      {open ? (
        <div id="menu-movil" className="border-t border-tinta/10 bg-papel lg:hidden">
          <nav aria-label="Principal móvil" className="container-sb flex flex-col py-3">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-tinta/10 py-4 text-base font-bold"
              >
                {l.label}
              </a>
            ))}
            <div className="flex flex-col gap-3 py-5">
              <Link href={LOGIN_HREF} className="site-btn site-btn-secondary">
                Iniciar sesión
              </Link>
              <Link href={SIGNUP_HREF} className="site-btn site-btn-primary">
                Crear cuenta
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
