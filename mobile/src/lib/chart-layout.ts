import type { ChartSegment } from "@cms/shared";

export interface ChartChunk {
  chord: string | null;
  text: string;
  /** The word continues in the next chunk (a chord falls mid-word), so no line break may come between them. */
  joined?: true;
}

/**
 * Splits a chart line into word-sized pieces so it can wrap on a narrow phone screen while every chord
 * stays above the syllable where it is played. Only the first piece of a segment carries its chord.
 */
export function chunkLine(segments: ChartSegment[]): ChartChunk[] {
  const chunks: ChartChunk[] = [];
  segments.forEach((segment, i) => {
    const words = segment.text.match(/\S+\s*|\s+/g) ?? [""];
    words.forEach((word, w) => {
      const chunk: ChartChunk = {
        chord: w === 0 ? segment.chord : null,
        text: word,
      };
      const last = w === words.length - 1;
      const next = segments[i + 1];
      // A chord in the middle of a word ("be[A]ginning") keeps both halves together.
      if (
        last &&
        next &&
        word &&
        !/\s$/.test(word) &&
        next.text &&
        !/^\s/.test(next.text)
      )
        chunk.joined = true;
      chunks.push(chunk);
    });
  });
  return chunks;
}
