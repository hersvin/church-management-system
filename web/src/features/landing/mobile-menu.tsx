"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { LandingLink } from "./content";
import { styles } from "./styles";

/** Narrow-screen navigation: the header's links and actions folded behind one button. */
export function MobileMenu({ links, cta }: { links: LandingLink[]; cta: LandingLink }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`${styles.btn} ${styles.secondary} ${styles.menuButton}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "Menu"}
      </button>
      {open && (
        <nav id={panelId} aria-label="Main" className={styles.menuPanel}>
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link href="/login">Staff sign in</Link>
          <a href={cta.href} className={`${styles.btn} ${styles.primary}`} onClick={() => setOpen(false)}>
            {cta.label}
          </a>
        </nav>
      )}
    </>
  );
}
