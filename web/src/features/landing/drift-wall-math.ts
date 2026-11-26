/** Pure helpers for DriftWall: how tiles split into columns, how far each column loops, and how fast. */

export type DriftDirection = "up" | "down";

/** Deals items across columns in turn; a column left empty borrows from the start so none is blank. */
export function splitColumns<T>(items: readonly T[], columns: number): T[][] {
  const cols: T[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, i) => cols[i % columns].push(item));
  if (items.length === 0) return cols;
  return cols.map((col, c) => (col.length ? col : [items[c % items.length]]));
}

/** Copies of a column needed so the loop never shows a gap: 1.6 times the container, plus one, at least two. */
export function copiesFor(count: number, unit: number, containerHeight: number): number {
  const copyHeight = Math.max(unit, count * unit);
  return Math.max(2, Math.ceil((containerHeight * 1.6) / copyHeight) + 1);
}

/** Offset folded into one copy's height, for either drift direction. */
export const wrapOffset = (offset: number, period: number) => ((offset % period) + period) % period;

/** Golden-ratio spread so neighbouring columns never share a speed. */
const columnFactor = (index: number, variance: number) => 1 + variance * ((((index * 0.6180339887 + 0.35) % 1) * 2) - 1);

/** Pixels per second for column `index`: columns alternate direction around the main one. */
export function columnVelocity(index: number, o: { speed: number; direction: DriftDirection; variance: number }): number {
  const dir = o.direction === "up" ? 1 : -1;
  const alt = index % 2 === 0 ? 1 : -1;
  return o.speed * columnFactor(index, o.variance) * dir * alt;
}
