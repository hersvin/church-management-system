"use client";

import { motion, useAnimationFrame, useInView, useMotionValue, useReducedMotionConfig } from "motion/react";
import { useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { PhotoPlaceholder, cx } from "./photo-placeholder";
import { styles } from "./styles";

export interface CarouselItem {
  title: string;
  caption: string;
  brief: string;
}

/** Drift speed in pixels per second: slow enough to read a caption as it passes. */
const SPEED = 28;

function Slides({ items }: { items: readonly CarouselItem[] }) {
  return items.map((g) => (
    <li key={g.title} className={styles.slide}>
      <PhotoPlaceholder brief={g.brief} className={styles.galleryPhoto} />
      <div className={styles.galleryCaption}>
        <strong>{g.title}</strong>
        <span className={styles.small}>{g.caption}</span>
      </div>
    </li>
  ));
}

/**
 * The week at church as an endless, slow row of photos. The row repeats once so the loop has
 * no seam; the copy is hidden from assistive tech. It stops on hover, keyboard focus, the Pause
 * button, or when scrolled out of view, and stands still as a grid for visitors who ask for less motion.
 */
export function GalleryCarousel({ items, label = "A week at Grace" }: { items: readonly CarouselItem[]; label?: string }) {
  const reduced = useReducedMotionConfig() ?? false;
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const firstSet = useRef<HTMLUListElement>(null);
  const inView = useInView(viewport, { margin: "120px 0px" });
  const x = useMotionValue(0);

  useAnimationFrame((_, delta) => {
    if (reduced || paused || held || !inView || !firstSet.current) return;
    const loop = firstSet.current.offsetWidth;
    if (loop === 0) return;
    let next = x.get() - (SPEED * Math.min(delta, 64)) / 1000;
    if (next <= -loop) next += loop;
    x.set(next);
  });

  if (reduced) {
    return (
      <ul className={styles.gallery} aria-label={label}>
        <Slides items={items} />
      </ul>
    );
  }

  return (
    <div className={styles.carousel}>
      <div
        ref={viewport}
        className={styles.carouselViewport}
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHeld(false)}
      >
        <motion.div className={styles.carouselTrack} style={{ x }}>
          <ul ref={firstSet} className={styles.carouselSet} aria-label={label}>
            <Slides items={items} />
          </ul>
          <ul className={styles.carouselSet} aria-hidden inert>
            <Slides items={items} />
          </ul>
        </motion.div>
      </div>
      <div className={styles.wrap}>
        <button
          type="button"
          className={cx(styles.btn, styles.secondary, styles.carouselToggle)}
          aria-pressed={paused}
          aria-label={paused ? "Play photos" : "Pause photos"}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
          {paused ? "Play" : "Pause"}
        </button>
      </div>
    </div>
  );
}
