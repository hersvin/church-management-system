import { CATEGORY_COLORS, posterScale, readableOn, SIZES, type Design } from "./design";
import { gridGeometry, type Poster, type PosterEntry, type Rect } from "./model";

/** A clickable region of the drawn image and the day it belongs to. */
export interface HitArea {
  rect: Rect;
  dayKey: string;
}

type Fonts = { heading: string; body: string };

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.width, r.height, radius);
}

const withAlpha = (hex: string, alpha: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/**
 * Draws the calendar image at full export size and returns the regions a click can select.
 * The same canvas is the preview and the PNG, so what you see is what you download.
 */
export function drawPoster(ctx: CanvasRenderingContext2D, poster: Poster, d: Design, fonts: Fonts): HitArea[] {
  const { width: W, height: H } = SIZES[d.size];
  const s = posterScale(SIZES[d.size]);
  const pad = 56 * s;
  const c = d.colors;
  const banded = d.style === "colorful" || d.style === "bold";
  const hits: HitArea[] = [];

  ctx.canvas.width = W;
  ctx.canvas.height = H;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.background;
  ctx.fillRect(0, 0, W, H);

  // Header
  const headerH = 210 * s;
  const titleColor = banded ? readableOn(c.header, true) : c.text;
  if (banded) {
    ctx.fillStyle = c.header;
    ctx.fillRect(0, 0, W, headerH);
  }
  ctx.fillStyle = titleColor;
  ctx.font = `500 ${92 * s}px ${fonts.heading}`;
  ctx.textAlign = "left";
  ctx.fillText(fit(ctx, d.title, W - pad * 2 - 140 * s), pad, 112 * s);
  ctx.font = `500 ${30 * s}px ${fonts.body}`;
  ctx.textAlign = "right";
  ctx.fillText(poster.year, W - pad, 112 * s);
  ctx.textAlign = "left";
  ctx.font = `400 ${30 * s}px ${fonts.body}`;
  ctx.globalAlpha = 0.9;
  ctx.fillText(fit(ctx, d.subtitle, W - pad * 2), pad, 166 * s);
  ctx.globalAlpha = 1;
  if (!banded) {
    ctx.fillStyle = c.text;
    ctx.fillRect(pad, headerH - 14 * s, W - pad * 2, (d.style === "ink" ? 3 : 1) * s);
  }

  const footerH = d.showFooter ? 70 * s : 20 * s;
  const body: Rect = { x: pad, y: headerH + 28 * s, width: W - pad * 2, height: H - headerH - 28 * s - footerH - 16 * s };

  if (d.layout === "list") drawList(ctx, poster.list, body, d, fonts, s, hits, poster);
  else drawGrid(ctx, poster, body, d, fonts, s, hits);

  if (d.showFooter && d.footer) {
    ctx.fillStyle = withAlpha(c.text, 0.25);
    ctx.fillRect(pad, H - footerH + 4 * s, W - pad * 2, 1 * s);
    ctx.fillStyle = withAlpha(c.text, 0.8);
    ctx.font = `400 ${24 * s}px ${fonts.body}`;
    ctx.fillText(fit(ctx, d.footer, W - pad * 2), pad, H - 30 * s);
  }
  return hits;
}

function chipColors(d: Design, category: string) {
  if (d.style === "colorful") return { fill: CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER, text: "#ffffff" };
  if (d.style === "bold") return { fill: d.colors.accent, text: readableOn(d.colors.accent) };
  return { fill: null, text: d.colors.text };
}

function drawGrid(ctx: CanvasRenderingContext2D, poster: Poster, area: Rect, d: Design, fonts: Fonts, s: number, hits: HitArea[]) {
  const c = d.colors;
  const week = d.layout === "week";
  const weeks = week ? [poster.weeks[Math.min(d.week, poster.weeks.length - 1)]] : poster.weeks;
  const headH = 44 * s;
  const gap = d.style === "ink" || d.style === "minimal" ? 0 : 8 * s;

  ctx.font = `500 ${22 * s}px ${fonts.body}`;
  ctx.textAlign = "center";
  ctx.fillStyle = d.style === "colorful" ? c.accent : c.text;
  const g = gridGeometry({ x: area.x, y: area.y + headH, width: area.width, height: area.height - headH }, weeks.length, gap);
  poster.weekdays.forEach((name, col) => {
    const cell = g.cell(0, col);
    ctx.fillText(name.toUpperCase(), cell.x + cell.width / 2, area.y + 28 * s);
  });
  ctx.textAlign = "left";

  weeks.forEach((days, row) =>
    days.forEach((day, col) => {
      const cell = g.cell(row, col);
      if (d.style === "colorful") {
        ctx.fillStyle = day.inMonth ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 255, 255, 0.25)";
        roundRect(ctx, cell, 10 * s);
        ctx.fill();
      } else if (d.style === "bold") {
        ctx.fillStyle = day.inMonth ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.03)";
        roundRect(ctx, cell, 6 * s);
        ctx.fill();
      } else {
        ctx.strokeStyle = withAlpha(c.text, d.style === "ink" ? 0.45 : 0.15);
        ctx.lineWidth = 1 * s;
        ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);
      }
      if (!day.inMonth && !week) return;
      hits.push({ rect: cell, dayKey: day.key });

      const inset = 8 * s;
      ctx.fillStyle = day.inMonth ? c.text : withAlpha(c.text, 0.4);
      ctx.font = `600 ${(week ? 30 : 22) * s}px ${fonts.body}`;
      ctx.fillText(String(day.day), cell.x + inset, cell.y + (week ? 40 : 28) * s);

      const lineH = (week ? 26 : 19) * s;
      const chipH = lineH * (d.showTimes ? 2 : 1) + 8 * s;
      const top = cell.y + (week ? 56 : 38) * s;
      const step = chipH + 4 * s;
      const space = cell.y + cell.height - inset - top + 4 * s;
      const moreH = lineH * 1.1;
      // Everything if it fits; otherwise as many chips as leave one text line for "+N more".
      const shown = day.entries.length * step <= space ? day.entries.length : Math.max(0, Math.floor((space - moreH) / step));
      day.entries.slice(0, shown).forEach((entry, i) => {
        const r = { x: cell.x + inset * 0.6, y: top + i * step, width: cell.width - inset * 1.2, height: chipH };
        drawChip(ctx, entry, r, d, fonts, lineH, s);
      });
      if (shown < day.entries.length && space >= moreH) {
        ctx.fillStyle = withAlpha(c.text, 0.75);
        ctx.font = `600 ${lineH * 0.85}px ${fonts.body}`;
        ctx.fillText(`+${day.entries.length - shown} more`, cell.x + inset, top + shown * step + lineH);
      }
    }),
  );
}

function drawChip(ctx: CanvasRenderingContext2D, entry: PosterEntry, r: Rect, d: Design, fonts: Fonts, lineH: number, s: number) {
  const colors = chipColors(d, entry.category);
  const textX = r.x + (colors.fill ? 6 * s : 8 * s);
  if (colors.fill) {
    ctx.fillStyle = colors.fill;
    roundRect(ctx, r, 6 * s);
    ctx.fill();
  } else {
    ctx.fillStyle = d.style === "minimal" ? d.colors.accent : d.colors.text;
    ctx.fillRect(r.x, r.y, 3 * s, r.height);
  }
  const max = r.width - (textX - r.x) - 4 * s;
  ctx.fillStyle = colors.text;
  ctx.font = `600 ${lineH * 0.82}px ${fonts.body}`;
  ctx.fillText(fit(ctx, entry.title, max), textX, r.y + lineH * 0.95);
  if (d.showTimes) {
    ctx.font = `400 ${lineH * 0.75}px ${fonts.body}`;
    ctx.globalAlpha = 0.9;
    const extra = d.showRooms && entry.room ? ` · ${entry.room}` : "";
    ctx.fillText(fit(ctx, `${entry.time}${extra}`, max), textX, r.y + lineH * 1.9);
    ctx.globalAlpha = 1;
  }
}

function drawList(
  ctx: CanvasRenderingContext2D,
  entries: PosterEntry[],
  area: Rect,
  d: Design,
  fonts: Fonts,
  s: number,
  hits: HitArea[],
  poster: Poster,
) {
  const c = d.colors;
  if (entries.length === 0) {
    ctx.fillStyle = withAlpha(c.text, 0.7);
    ctx.font = `400 ${30 * s}px ${fonts.body}`;
    ctx.fillText("No events this month.", area.x, area.y + 40 * s);
    return;
  }
  const rowH = Math.min(86 * s, area.height / entries.length);
  const size = Math.max(14 * s, Math.min(30 * s, rowH * 0.36));
  const dayKeys = new Map(poster.weeks.flat().flatMap((day) => day.entries.map((e) => [e.id, day.key] as const)));
  entries.forEach((e, i) => {
    const y = area.y + i * rowH;
    const colors = chipColors(d, e.category);
    ctx.fillStyle = colors.fill ?? (d.style === "minimal" ? c.accent : c.text);
    roundRect(ctx, { x: area.x, y: y + rowH * 0.2, width: 6 * s, height: rowH * 0.6 }, 3 * s);
    ctx.fill();
    ctx.fillStyle = d.style === "colorful" ? c.accent : c.text;
    ctx.font = `700 ${size}px ${fonts.body}`;
    ctx.fillText(e.dateLabel, area.x + 24 * s, y + rowH * 0.62);
    ctx.fillStyle = c.text;
    ctx.font = `500 ${size * 1.05}px ${fonts.heading}`;
    const timeW = d.showTimes ? 190 * s : 0;
    const titleX = area.x + 24 * s + size * 5;
    const sub = d.showRooms && e.room ? e.room : null;
    ctx.fillText(fit(ctx, e.title, area.x + area.width - titleX - timeW), titleX, y + rowH * (sub ? 0.48 : 0.62));
    if (sub) {
      ctx.font = `400 ${size * 0.7}px ${fonts.body}`;
      ctx.fillStyle = withAlpha(c.text, 0.7);
      ctx.fillText(fit(ctx, sub, area.x + area.width - titleX - timeW), titleX, y + rowH * 0.8);
    }
    if (d.showTimes) {
      ctx.fillStyle = withAlpha(c.text, 0.85);
      ctx.font = `400 ${size * 0.85}px ${fonts.body}`;
      ctx.textAlign = "right";
      ctx.fillText(e.time, area.x + area.width, y + rowH * 0.62);
      ctx.textAlign = "left";
    }
    if (i < entries.length - 1) {
      ctx.fillStyle = withAlpha(c.text, 0.12);
      ctx.fillRect(area.x + 24 * s, y + rowH - 1, area.width - 24 * s, 1);
    }
    hits.push({ rect: { x: area.x, y, width: area.width, height: rowH }, dayKey: dayKeys.get(e.id) ?? "" });
  });
}
