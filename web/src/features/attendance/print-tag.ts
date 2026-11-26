import { formatPickupCode } from "./format";

export interface PickupTag {
  child: string;
  code: string;
  gathering: string;
  careNote?: string | null;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A printable page with the child's tag and the guardian's stub; both carry the same code. */
export function tagHtml(tag: PickupTag): string {
  const code = escapeHtml(formatPickupCode(tag.code));
  const child = escapeHtml(tag.child);
  const gathering = escapeHtml(tag.gathering);
  const note = tag.careNote ? `<p class="note">${escapeHtml(tag.careNote)}</p>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Pickup tag</title><style>
body{font-family:system-ui,sans-serif;margin:0;padding:12px}
.tag{border:2px dashed #555;border-radius:10px;padding:12px 16px;margin-bottom:12px;width:300px}
.code{font:700 34px ui-monospace,monospace;letter-spacing:4px;margin:6px 0}
.name{font-size:20px;font-weight:700;margin:0}.small{font-size:12px;color:#444;margin:0}
.note{background:#fde68a;padding:4px 6px;border-radius:4px;font-size:13px;margin:6px 0 0}
</style></head><body>
<div class="tag"><p class="small">Child tag · ${gathering}</p><p class="name">${child}</p><p class="code">${code}</p>${note}</div>
<div class="tag"><p class="small">Guardian stub · show this at pickup</p><p class="name">${child}</p><p class="code">${code}</p></div>
</body></html>`;
}

/** Opens the tags in a small window and starts printing. */
export function printTag(tag: PickupTag): void {
  const win = window.open("", "_blank", "width=380,height=480");
  if (!win) return;
  win.document.write(tagHtml(tag));
  win.document.close();
  win.focus();
  win.print();
}
