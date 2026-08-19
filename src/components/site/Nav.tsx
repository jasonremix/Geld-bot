"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/#vorteile", label: "Vorteile" },
  { href: "/#pläne", label: "Pläne" },
  { href: "/#inhalte", label: "Inhalte" },
  { href: "/#creator", label: "Creator" },
  { href: "/#faq", label: "FAQ" },
];

export function Nav({ authenticated }: { authenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "border-b border-[var(--color-line)] bg-black/85 backdrop-blur-xl" : ""
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="equalizer flex h-4 items-end gap-[3px]" aria-hidden="true">
            <span style={{ animationDelay: "0ms" }} />
            <span style={{ animationDelay: "160ms" }} />
            <span style={{ animationDelay: "320ms" }} />
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.28em]">Creator Hub</span>
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-muted)] transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href={authenticated ? "/dashboard" : "/login"}
            className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-muted)] transition-colors hover:text-white"
          >
            {authenticated ? "Dashboard" : "Login"}
          </Link>
          <Link href="/checkout?plan=pro" className="btn btn-primary !px-6 !py-3">
            Jetzt starten
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-[6px] md:hidden"
        >
          <span
            className={`h-px w-6 bg-white transition-transform duration-300 ${open ? "translate-y-[3.5px] rotate-45" : ""}`}
          />
          <span
            className={`h-px w-6 bg-white transition-transform duration-300 ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`}
          />
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 top-16 z-40 flex flex-col bg-black px-6 pt-10 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="display border-b border-[var(--color-line)] py-6 text-3xl"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-10 flex flex-col gap-3">
            <Link
              href={authenticated ? "/dashboard" : "/login"}
              onClick={() => setOpen(false)}
              className="btn btn-ghost"
            >
              {authenticated ? "Dashboard" : "Login"}
            </Link>
            <Link href="/checkout?plan=pro" onClick={() => setOpen(false)} className="btn btn-primary">
              Jetzt starten
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
