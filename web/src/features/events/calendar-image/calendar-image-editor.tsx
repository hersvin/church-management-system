"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { DownloadIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useBranches } from "@/features/admin/queries";
import { useEvents } from "@/features/events/api";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { defaultDesign, LAYOUTS, PALETTES, SIZE_GROUPS, SIZES, STYLE_PRESETS, withPalette, withStyle, type Colors, type Design, type FontKey, type StyleKey } from "./design";
import { drawPoster, type HitArea } from "./draw";
import { FONTS } from "./fonts";
import { buildPoster, monthLabel, timeLabel, type EventEdits } from "./model";

const pad = (n: number) => String(n).padStart(2, "0");
const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const COLOR_FIELDS: { key: keyof Colors; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "header", label: "Header" },
  { key: "accent", label: "Accent" },
  { key: "text", label: "Text" },
];

function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (key: T) => void;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="micro-label mb-1.5">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Button key={String(o.key)} type="button" size="sm" variant={o.key === value ? "default" : "outline"} aria-pressed={o.key === value} onClick={() => onChange(o.key)}>
            {o.label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

const Field = ({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) => (
  <div className="grid gap-1">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

/** Editor for a shareable calendar image: live canvas preview on the left, controls on the right. */
export function CalendarImageEditor({ initialMonth }: { initialMonth?: string }) {
  const me = useSessionStore((s) => s.user);
  const can = useSessionStore((s) => s.can);
  const [month, setMonth] = useState(initialMonth ?? thisMonth());
  const [branchId, setBranchId] = useState<string>(me?.branchId ?? "");
  const [edits, setEdits] = useState<EventEdits>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [design, setDesign] = useState<Design>(() =>
    defaultDesign({ title: monthLabel(initialMonth ?? thisMonth()).month, subtitle: "What's on this month", footer: "" }),
  );
  const [wordsTouched, setWordsTouched] = useState({ subtitle: false, footer: false });
  const canvas = useRef<HTMLCanvasElement>(null);
  const hits = useRef<HitArea[]>([]);

  const branches = useBranches(can("branches.read"));
  const church = useQuery({
    queryKey: ["public", "landing"],
    queryFn: () => apiFetch<{ church: { name: string | null; email: string | null } }>("/public/landing"),
    staleTime: 5 * 60 * 1000,
  });
  const [y, m] = month.split("-").map(Number);
  const range = { from: new Date(y, m - 1, 1).toISOString(), to: new Date(y, m, 1).toISOString() };
  const events = useEvents(range);

  const branch = branches.data?.find((b) => b.id === branchId);
  const churchName = church.data?.church.name ?? "our church";
  const subtitle = wordsTouched.subtitle ? design.subtitle : `What's on at ${churchName}`;
  const footer = wordsTouched.footer
    ? design.footer
    : [branch?.name ?? (branchId ? "" : "All campuses"), branch?.address, church.data?.church.email].filter(Boolean).join(" · ");
  const effective = useMemo(() => ({ ...design, subtitle, footer }), [design, subtitle, footer]);

  const rawEvents = useMemo(
    () =>
      (events.data ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        status: e.status,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        branchId: e.branchId,
        room: e.room?.name ?? null,
      })),
    [events.data],
  );
  const poster = useMemo(
    () => buildPoster({ month, events: rawEvents, weekStart: design.weekStart, branchId: branchId || undefined, edits }),
    [month, rawEvents, design.weekStart, branchId, edits],
  );
  const monthEvents = rawEvents.filter((e) => e.status !== "CANCELLED" && (!branchId || e.branchId === branchId));

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let live = true;
    const heading = FONTS[effective.headingFont].family;
    const body = FONTS[effective.bodyFont].family;
    // Draw at once, then again when the chosen faces finish loading.
    hits.current = drawPoster(ctx, poster, effective, { heading, body });
    Promise.all(["500 40px", "400 40px", "600 40px", "700 40px"].flatMap((w) => [document.fonts.load(`${w} ${heading}`), document.fonts.load(`${w} ${body}`)]))
      .then(() => {
        if (live) hits.current = drawPoster(ctx, poster, effective, { heading, body });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [poster, effective]);

  function selectFromCanvas(event: MouseEvent<HTMLCanvasElement>) {
    const el = event.currentTarget;
    const box = el.getBoundingClientRect();
    const x = ((event.clientX - box.left) * el.width) / box.width;
    const yPos = ((event.clientY - box.top) * el.height) / box.height;
    const hit = hits.current.find((h) => x >= h.rect.x && x <= h.rect.x + h.rect.width && yPos >= h.rect.y && yPos <= h.rect.y + h.rect.height);
    if (!hit) return;
    setSelectedDay(hit.dayKey);
    document.getElementById(`day-${hit.dayKey}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function changeMonth(next: string) {
    setDesign((d) => (d.title === monthLabel(month).month ? { ...d, title: monthLabel(next).month, week: 0 } : { ...d, week: 0 }));
    setMonth(next);
    setSelectedDay(null);
  }

  function download() {
    canvas.current?.toBlob((blob) => {
      if (!blob) {
        toast.error("The image could not be created. Try again.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `calendar-${month}-${design.layout}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  const set = <K extends keyof Design>(key: K, value: Design[K]) => setDesign((d) => ({ ...d, [key]: value }));
  const fontOptions = Object.entries(FONTS) as [FontKey, (typeof FONTS)[FontKey]][];
  const byDay = new Map<string, typeof monthEvents>();
  for (const e of [...monthEvents].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const d = new Date(e.startsAt);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
      <div className="bg-muted/60 border-border flex flex-col items-center gap-2 rounded-lg border p-3 lg:sticky lg:top-16 lg:self-start">
        <canvas
          ref={canvas}
          onClick={selectFromCanvas}
          role="img"
          aria-label={`Calendar image for ${poster.month} ${poster.year}, ${poster.list.length} events`}
          className={cn(
            "h-auto w-full max-w-full cursor-pointer rounded-sm",
            SIZES[design.size].height > SIZES[design.size].width * 1.3 && "max-h-[75vh] w-auto",
          )}
        />
        <p className="text-muted-foreground text-xs">
          Click a day on the image to edit its events. {events.isPending && "Loading events…"}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Month" htmlFor="ci-month">
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="sm" aria-label="Previous month" onClick={() => changeMonth(shiftMonth(month, -1))}>
                ‹
              </Button>
              <Input id="ci-month" type="month" value={month} onChange={(e) => e.target.value && changeMonth(e.target.value)} className="w-40" />
              <Button type="button" variant="outline" size="sm" aria-label="Next month" onClick={() => changeMonth(shiftMonth(month, 1))}>
                ›
              </Button>
            </div>
          </Field>
          {!me?.branchId && branches.data && (
            <Field label="Branch" htmlFor="ci-branch">
              <NativeSelect id="ci-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-40">
                <option value="">All branches</option>
                {branches.data.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>

        <Field label="Title" htmlFor="ci-title">
          <Input id="ci-title" value={design.title} maxLength={40} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Subtitle" htmlFor="ci-subtitle">
          <Input
            id="ci-subtitle"
            value={subtitle}
            maxLength={80}
            onChange={(e) => {
              setWordsTouched((w) => ({ ...w, subtitle: true }));
              set("subtitle", e.target.value);
            }}
          />
        </Field>

        <Segmented label="Style" value={design.style} options={(Object.keys(STYLE_PRESETS) as StyleKey[]).map((k) => ({ key: k, label: STYLE_PRESETS[k].label }))} onChange={(k) => setDesign((d) => withStyle(d, k))} />

        <fieldset className="grid gap-1.5">
          <legend className="micro-label mb-1.5">Palette</legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PALETTES).map(([name, colors]) => (
              <Button key={name} type="button" size="sm" variant="outline" onClick={() => setDesign((d) => withPalette(d, name))}>
                <span aria-hidden className="size-3 rounded-full" style={{ background: colors.header }} />
                {name}
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="micro-label mb-1.5">Colors</legend>
          {COLOR_FIELDS.map((f) => (
            <label key={f.key} className="border-border flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm">
              {f.label}
              <span className="flex items-center gap-1.5">
                <span className="font-data text-muted-foreground text-[11px] uppercase">{design.colors[f.key]}</span>
                <input
                  type="color"
                  value={design.colors[f.key]}
                  onChange={(e) => setDesign((d) => ({ ...d, colors: { ...d.colors, [f.key]: e.target.value } }))}
                  className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label={`${f.label} color`}
                />
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Heading font" htmlFor="ci-heading">
            <NativeSelect id="ci-heading" value={design.headingFont} onChange={(e) => set("headingFont", e.target.value as FontKey)}>
              {fontOptions.map(([key, f]) => (
                <option key={key} value={key}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Body font" htmlFor="ci-body">
            <NativeSelect id="ci-body" value={design.bodyFont} onChange={(e) => set("bodyFont", e.target.value as FontKey)}>
              {fontOptions.map(([key, f]) => (
                <option key={key} value={key}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <Segmented label="Layout" value={design.layout} options={LAYOUTS} onChange={(k) => set("layout", k)} />
        {design.layout === "week" && (
          <Segmented label="Week" value={design.week} options={poster.weeks.map((w, i) => ({ key: i, label: `${w[0].day} to ${w[6].day}` }))} onChange={(k) => set("week", k)} />
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Week starts on" htmlFor="ci-weekstart">
            <NativeSelect id="ci-weekstart" value={design.weekStart} onChange={(e) => set("weekStart", Number(e.target.value) as 0 | 1)}>
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
            </NativeSelect>
          </Field>
          <Field label="Size" htmlFor="ci-size">
            <NativeSelect id="ci-size" value={design.size} onChange={(e) => set("size", e.target.value as Design["size"])}>
              {SIZE_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.sizes.map((key) => (
                    <option key={key} value={key}>
                      {SIZES[key].label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["showTimes", "Times"],
              ["showRooms", "Rooms"],
              ["showFooter", "Footer"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={design[key]} onChange={(e) => set(key, e.target.checked)} className="accent-foreground size-4" />
              {label}
            </label>
          ))}
        </div>
        {design.showFooter && (
          <Field label="Footer" htmlFor="ci-footer">
            <Input
              id="ci-footer"
              value={footer}
              maxLength={120}
              onChange={(e) => {
                setWordsTouched((w) => ({ ...w, footer: true }));
                set("footer", e.target.value);
              }}
            />
          </Field>
        )}

        <Button type="button" onClick={download}>
          <DownloadIcon />
          Download PNG
        </Button>

        <section aria-labelledby="ci-events" className="border-border flex flex-col gap-2 border-t pt-3">
          <h2 id="ci-events" className="micro-label">
            Events on the image
          </h2>
          {byDay.size === 0 && <p className="text-muted-foreground text-sm">No events this month.</p>}
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {[...byDay.entries()].map(([key, list]) => (
              <div
                key={key}
                id={`day-${key}`}
                className={cn("rounded-md border p-2 transition-colors", selectedDay === key ? "border-foreground bg-muted" : "border-border")}
              >
                <div className="font-data text-muted-foreground mb-1 text-xs">{key}</div>
                {list.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={!edits[e.id]?.hidden}
                      onChange={(ev) => setEdits((all) => ({ ...all, [e.id]: { ...all[e.id], hidden: !ev.target.checked } }))}
                      aria-label={`Show ${e.title} on the image`}
                      className="accent-foreground size-4 shrink-0"
                    />
                    <Input
                      value={edits[e.id]?.title ?? e.title}
                      maxLength={60}
                      onChange={(ev) => setEdits((all) => ({ ...all, [e.id]: { ...all[e.id], title: ev.target.value } }))}
                      aria-label={`Title on the image for ${e.title}`}
                      className="h-7 text-sm"
                    />
                    <span className="font-data text-muted-foreground shrink-0 text-[11px]">{timeLabel(e.startsAt)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
