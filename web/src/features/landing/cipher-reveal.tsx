"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { CIPHER_GLYPHS, cipherFrame, resolveTimes } from "./cipher";

/** How often the unresolved glyphs change, so the scramble reads as flicker, not noise. */
const FLICKER_MS = 55;

const randomGlyph = () => CIPHER_GLYPHS[Math.floor(Math.random() * CIPHER_GLYPHS.length)];

/**
 * A headline that decodes out of scrambled characters, once, left to right (about 1.3 s).
 * Each character keeps the width of its real letter, so lines never reflow while it runs.
 * Screen readers get the real text only; reduced motion shows it at once.
 */
export function CipherReveal({ text, delay = 250, spread = 1000 }: { text: string; delay?: number; spread?: number }) {
  const reduced = useReducedMotion();
  // The first render (server and client alike) is the real text, so hydration always matches.
  const [cursor, setCursor] = useState(text.length);
  const [glyphs, setGlyphs] = useState<string[]>([]);

  useEffect(() => {
    if (reduced) return;
    const times = resolveTimes(text.length, { delay, spread });
    let frame = 0;
    let lastFlicker = -Infinity;
    const begin = performance.now();
    const tick = (now: number) => {
      const elapsed = now - begin;
      const settled = times.findIndex((t) => t > elapsed);
      setCursor(settled === -1 ? text.length : settled);
      if (now - lastFlicker >= FLICKER_MS) {
        lastFlicker = now;
        setGlyphs(Array.from(text, randomGlyph));
      }
      if (settled !== -1) frame = requestAnimationFrame(tick);
    };
    // The first frame scrambles everything; the hero fades in from transparent, so the real text never flashes.
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, delay, spread, reduced]);

  const chars = cipherFrame(text, reduced ? text.length : cursor, (i) => glyphs[i] ?? text[i]);
  // Split into words so the browser still wraps between words, never inside one.
  const words: { char: string; resolved: boolean; real: string }[][] = [[]];
  Array.from(text).forEach((real, i) => {
    if (real === " ") words.push([]);
    else words[words.length - 1].push({ ...chars[i], real });
  });

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" data-cipher-visual>
        {words.map((word, w) => (
          <span key={w}>
            {w > 0 && " "}
            <span className="lp-cipher-word">
              {word.map((c, i) =>
                c.resolved ? (
                  <span key={i}>{c.real}</span>
                ) : (
                  <span key={i} className="lp-cipher-cell">
                    <span className="lp-cipher-ghost">{c.real}</span>
                    <span className="lp-cipher-glyph">{c.char}</span>
                  </span>
                ),
              )}
            </span>
          </span>
        ))}
      </span>
    </>
  );
}
