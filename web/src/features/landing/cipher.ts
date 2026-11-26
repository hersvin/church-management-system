/** Characters a headline flickers through before it settles. */
export const CIPHER_GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/";

export interface CipherChar {
  char: string;
  resolved: boolean;
}

/** Letters and digits scramble; spaces and punctuation hold still so words keep their shape. */
const SCRAMBLES = /[\p{L}\p{N}]/u;

/** One frame: characters before `cursor` are real, the rest show a glyph from `pick`. */
export function cipherFrame(text: string, cursor: number, pick: (index: number) => string): CipherChar[] {
  return Array.from(text, (char, i) =>
    i < cursor || !SCRAMBLES.test(char) ? { char, resolved: true } : { char: pick(i), resolved: false },
  );
}

/** Milliseconds at which each character settles, evenly from `delay` to `delay + spread`. */
export function resolveTimes(length: number, { delay, spread }: { delay: number; spread: number }): number[] {
  if (length <= 1) return length === 1 ? [delay] : [];
  return Array.from({ length }, (_, i) => delay + (i / (length - 1)) * spread);
}
