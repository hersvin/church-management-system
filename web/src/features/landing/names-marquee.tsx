"use client";

import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotionConfig,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";
import { useRef, useState, type Ref } from "react";
import { MotionToggle } from "./motion-toggle";

/** Base drift in pixels per second for each row, slower and faster in turn. */
const BASE_SPEEDS = [34, 42, 30, 46, 38, 50];

function Row({
  names,
  index,
  boost,
  moving,
}: {
  names: readonly string[];
  index: number;
  boost: MotionValue<number>;
  moving: boolean;
}) {
  const x = useMotionValue(0);
  const set = useRef<HTMLSpanElement>(null);
  const direction = index % 2 === 0 ? -1 : 1;

  useAnimationFrame((_, delta) => {
    const loop = set.current?.offsetWidth ?? 0;
    if (!moving || loop === 0) return;
    const speed = BASE_SPEEDS[index % BASE_SPEEDS.length] * (1 + boost.get());
    let next = x.get() + (direction * speed * Math.min(delta, 64)) / 1000;
    // Keep x inside one copy's width so the two copies loop without a seam.
    if (next <= -loop) next += loop;
    if (next > 0) next -= loop;
    x.set(next);
  });

  // Each set repeats the names so one set is always wider than the band; two sets make the loop.
  const copy = (key: string, ref?: Ref<HTMLSpanElement>) => (
    <span key={key} ref={ref} className="lp-marqueeSet">
      {[...names, ...names].map((name, i) => (
        <span key={`${name}-${i}`} className="lp-marqueeName">
          {name}
        </span>
      ))}
    </span>
  );

  return (
    <motion.div className="lp-marqueeRow" style={{ x }}>
      {copy("a", set)}
      {copy("b")}
    </motion.div>
  );
}

/**
 * Rows of names drifting in alternating directions on a black band. Scrolling the page speeds
 * every row up for a moment, like a scroll-velocity marquee. Screen readers get one plain list;
 * the moving rows are hidden from them. Hover, the pause control, or scrolling it out of view
 * stops it, and it stands still for visitors who ask for less motion.
 */
export function NamesMarquee({ rows, label }: { rows: readonly (readonly string[])[]; label: string }) {
  const reduced = useReducedMotionConfig() ?? false;
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const band = useRef<HTMLDivElement>(null);
  const inView = useInView(band, { margin: "80px 0px" });
  const { scrollY } = useScroll();
  const smooth = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  // Up to four times faster while the page scrolls quickly, in either direction.
  const boost = useTransform(smooth, (v) => Math.min(4, Math.abs(v) / 400));
  const moving = !reduced && !paused && !held && inView;

  return (
    <div
      ref={band}
      className="lp-marquee"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
    >
      <ul className="sr-only" aria-label={label}>
        {rows.flat().map((name, i) => (
          <li key={`${name}-${i}`}>{name}</li>
        ))}
      </ul>
      <div className="lp-marqueeRows" aria-hidden="true">
        {rows.map((names, i) => (
          <Row key={i} names={names} index={i} boost={boost} moving={moving} />
        ))}
      </div>
      {!reduced && (
        <MotionToggle
          className="lp-marqueeToggle"
          paused={paused}
          onToggle={() => setPaused((p) => !p)}
          name={`${label.charAt(0).toLowerCase()}${label.slice(1)}`}
        />
      )}
    </div>
  );
}
