"use client";

import { useInView, useReducedMotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { columnVelocity, copiesFor, splitColumns, wrapOffset, type DriftDirection } from "./drift-wall-math";
import { MotionToggle } from "./motion-toggle";
import { cx } from "./photo-placeholder";
import "./drift-wall.css";

export interface DriftItem {
  id: string;
  /** What the tile shows, for example a photo or a photo placeholder. */
  content: ReactNode;
}

export interface DriftWallProps {
  items: readonly DriftItem[];
  /** Accessible name of the wall. */
  label: string;
  columns?: number;
  tileWidth?: number;
  tileHeight?: number;
  gap?: number;
  radius?: number;
  /** Perspective pitch (rotateX) in degrees. */
  tilt?: number;
  /** Perspective yaw (rotateY) in degrees. */
  turn?: number;
  roll?: number;
  perspective?: number;
  depth?: number;
  /** Base drift speed in pixels per second. */
  speed?: number;
  direction?: DriftDirection;
  variance?: number;
  /** Pointer-follow tilt strength; 0 turns it off. */
  parallax?: number;
  /** How far a hovered tile lifts toward the viewer, in pixels. */
  lift?: number;
  /** Edge and depth dissolve strength (0 to 1). */
  fade?: number;
  /** Resting opacity of tiles that are not hovered (0 to 1). */
  dim?: number;
  grayscale?: boolean;
  /** Tint laid over resting tiles, cleared on hover. */
  overlayColor?: string;
  className?: string;
}

/**
 * Adapted from React Bits DriftWall: a tilted wall of tiles whose columns drift up and down at
 * different speeds. Changes for this site: tiles take any content, copies of a tile are hidden
 * from assistive tech so each photo is announced once, tiles stay out of the tab order (they do
 * nothing when activated), a Pause button stops the drift, it rests when off screen, and it
 * stands still for visitors who ask for less motion.
 */
export function DriftWall({
  items,
  label,
  columns = 5,
  tileWidth = 200,
  tileHeight = 132,
  gap = 18,
  radius = 14,
  tilt = 16,
  turn = -14,
  roll = 0,
  perspective = 1200,
  depth = 120,
  speed = 42,
  direction = "up",
  variance = 0.45,
  parallax = 0.6,
  lift = 64,
  fade = 0.6,
  dim = 0.55,
  grayscale = false,
  overlayColor = "#060010",
  className,
}: DriftWallProps) {
  const reduced = useReducedMotionConfig() ?? false;
  const container = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const tracks = useRef<(HTMLDivElement | null)[]>([]);
  const offsets = useRef<number[]>([]);
  const velocities = useRef<number[]>([]);
  const hoveredColumn = useRef(-1);
  const pointer = useRef({ x: 0, y: 0 });
  const damped = useRef({ x: 0, y: 0 });
  const inView = useInView(container, { margin: "120px 0px" });
  const [height, setHeight] = useState(600);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const cols = useMemo(() => splitColumns(items, columns), [items, columns]);
  const unit = tileHeight + gap;
  const meta = useMemo(
    () => cols.map((col) => ({ copyHeight: Math.max(unit, col.length * unit), copies: copiesFor(col.length, unit, height) })),
    [cols, unit, height],
  );
  const velocity = useMemo(() => cols.map((_, c) => columnVelocity(c, { speed, direction, variance })), [cols, speed, direction, variance]);

  useEffect(() => {
    const el = container.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height || 600));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Start each column at a different point so the rows do not line up.
    offsets.current = meta.map((m, c) => m.copyHeight * ((c * 0.37) % 1));
    velocities.current = meta.map(() => 0);
  }, [meta]);

  useEffect(() => {
    let frame = 0;
    let last: number | null = null;
    const moving = !reduced && !paused && inView;
    const tick = (ts: number) => {
      const dt = last === null ? 0 : Math.min(0.05, (ts - last) / 1000);
      last = ts;

      const maxTilt = reduced ? 0 : parallax * 8;
      const ease = 1 - Math.exp(-dt / 0.12);
      damped.current.x += (pointer.current.x * maxTilt - damped.current.x) * ease;
      damped.current.y += (-pointer.current.y * maxTilt - damped.current.y) * ease;
      if (plane.current) {
        plane.current.style.transform =
          `translate(-50%, -50%) scale(1.18) rotateX(${tilt + damped.current.y}deg) ` +
          `rotateY(${turn + damped.current.x}deg) rotateZ(${roll}deg) translateZ(${-depth}px)`;
      }

      for (let c = 0; c < meta.length; c++) {
        const target = moving && hoveredColumn.current !== c ? velocity[c] : 0;
        const k = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
        velocities.current[c] = (velocities.current[c] ?? 0) + (target - (velocities.current[c] ?? 0)) * k;
        offsets.current[c] = wrapOffset((offsets.current[c] ?? 0) + velocities.current[c] * dt, meta[c].copyHeight);
        const track = tracks.current[c];
        if (track) track.style.transform = `translate3d(0, ${-offsets.current[c]}px, 0)`;
      }

      // Off screen, or under reduced motion, draw this one frame and rest until something changes.
      if (inView && !reduced) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [meta, velocity, reduced, paused, inView, parallax, tilt, turn, roll, depth]);

  const release = useCallback(() => {
    hoveredColumn.current = -1;
    setActiveId(null);
  }, []);

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = container.current?.getBoundingClientRect();
    if (!rect) return;
    if (parallax > 0 && !reduced) {
      pointer.current = { x: (event.clientX - rect.left) / rect.width - 0.5, y: (event.clientY - rect.top) / rect.height - 0.5 };
    }
    const tile = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-tile-id]");
    if (!tile) return;
    hoveredColumn.current = Number(tile.dataset.col);
    setActiveId(tile.dataset.tileId ?? null);
  }

  const vars = {
    "--dw-tile-w": `${tileWidth}px`,
    "--dw-tile-h": `${tileHeight}px`,
    "--dw-gap": `${gap}px`,
    "--dw-radius": `${radius}px`,
    "--dw-perspective": `${perspective}px`,
    "--dw-lift": `${lift}px`,
    "--dw-dim": dim,
    "--dw-gray": grayscale ? 1 : 0,
    "--dw-overlay": overlayColor,
    "--dw-edge": `${Math.max(0, (1 - fade) * 100)}%`,
  } as CSSProperties;

  return (
    <div className={cx("drift-wall-frame", className)}>
      <div
        ref={container}
        className={cx("drift-wall", reduced && "drift-wall--reduced")}
        style={vars}
        role="group"
        aria-label={label}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          pointer.current = { x: 0, y: 0 };
          release();
        }}
      >
        <div ref={plane} className="drift-wall__plane">
          {cols.map((col, c) => (
            <div className="drift-wall__col" key={c}>
              <div className="drift-wall__track" ref={(el) => void (tracks.current[c] = el)}>
                {Array.from({ length: meta[c].copies }, (_, copy) =>
                  col.map((item, i) => {
                    const id = `${c}-${copy}-${i}`;
                    return (
                      <div
                        key={id}
                        className={cx("drift-wall__tile", activeId === id && "is-active")}
                        data-tile-id={id}
                        data-col={c}
                        // The first copy of each tile carries its name; repeats are decoration.
                        aria-hidden={copy > 0 || undefined}
                      >
                        <span className="drift-wall__inner">
                          {item.content}
                          <span className="drift-wall__overlay" aria-hidden />
                        </span>
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {!reduced && (
        <MotionToggle
          className="drift-wall__toggle"
          paused={paused}
          onToggle={() => setPaused((p) => !p)}
          name={`${label.charAt(0).toLowerCase()}${label.slice(1)}`}
        />
      )}
    </div>
  );
}
