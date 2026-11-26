"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";
import { MailIcon } from "@/components/icons";
import "./profile-card.css";

const THEMES = {
  dark: {
    "--pc-frame": "rgba(38, 35, 46, 0.66)",
    "--pc-frame-edge": "rgba(255, 255, 255, 0.08)",
    "--pc-frame-highlight": "rgba(255, 255, 255, 0.07)",
    "--pc-frame-shadow": "0 22px 44px -20px rgba(0, 0, 0, 0.8), 0 6px 16px -8px rgba(0, 0, 0, 0.5)",
    "--pc-tile": "linear-gradient(180deg, #3a3644 0%, #27242f 100%)",
    "--pc-tile-edge": "rgba(255, 255, 255, 0.07)",
    "--pc-tile-highlight": "rgba(255, 255, 255, 0.12)",
    "--pc-tile-shadow": "0 4px 10px -4px rgba(0, 0, 0, 0.7)",
    "--pc-ink": "#f4f4f5",
    "--pc-muted": "rgba(244, 244, 245, 0.6)",
    "--pc-hover": "brightness(1.12)",
    "--pc-press": "brightness(0.8)",
    "--pc-shade": "rgba(0, 0, 0, 0.4)",
  },
  light: {
    "--pc-frame": "rgba(250, 249, 246, 0.85)",
    "--pc-frame-edge": "rgba(24, 24, 27, 0.08)",
    "--pc-frame-highlight": "rgba(255, 255, 255, 0.95)",
    "--pc-frame-shadow": "0 22px 44px -22px rgba(24, 24, 27, 0.3), 0 6px 16px -10px rgba(24, 24, 27, 0.16)",
    "--pc-tile": "linear-gradient(180deg, #ffffff 0%, #f6f6f8 100%)",
    "--pc-tile-edge": "rgba(24, 24, 27, 0.08)",
    "--pc-tile-highlight": "rgba(255, 255, 255, 1)",
    "--pc-tile-shadow": "0 4px 10px -5px rgba(24, 24, 27, 0.25)",
    "--pc-ink": "#1a1a1a",
    "--pc-muted": "rgba(26, 26, 26, 0.66)",
    "--pc-hover": "brightness(0.97)",
    "--pc-press": "brightness(0.92)",
    "--pc-shade": "rgba(24, 24, 27, 0.14)",
  },
} as const;

/** The portrait tile is dark (photo or placeholder), so the foil uses the dark blend in both themes. */
const DARK_FOIL = { "--pc-blend": "color-dodge", "--pc-holo-filter": "hue-rotate(0deg)", "--pc-sheen": "rgba(255, 255, 255, 0.16)" };

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='500' height='500'><filter id='g' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0.55 0 0 0 -0.24 0.55 0 0 0 -0.24 0.55 0 0 0 -0.24 0 0 0 0 1'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>",
)}")`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export interface ProfileCardProps {
  name: string;
  /** Role shown under the name. */
  title?: string;
  /** Short line in the footer, for example the person's campus. */
  status?: string;
  /** Portrait; without one the card shows a labelled placeholder with initials. */
  avatarUrl?: string;
  /** Where Contact goes, for example a mailto link. Without it there is no Contact button. */
  contactHref?: string;
  contactText?: string;
  theme?: "dark" | "light";
  radius?: number;
  /** Holographic foil strength (0 to 1); it lights up where the pointer catches it. */
  holo?: number;
  /** Strength of the light that follows the pointer (0 to 1). */
  glare?: number;
  enableTilt?: boolean;
  tiltStrength?: number;
  /** How far the portrait shifts as the card tilts, in pixels. */
  parallax?: number;
  /** Catch the light once as the card appears, then settle. */
  intro?: boolean;
  className?: string;
}

/**
 * Adapted from React Bits ProfileCard: a framed portrait that tilts toward the pointer with a
 * holographic foil and glare. Changes for this site: icons come from the app's icon set, Contact
 * is a link (usually mailto) named after the person, a labelled initials placeholder stands in
 * for missing portraits, the footer line is free text (a campus) without a status dot, and
 * phone-motion tilt is left out. Tilt, foil, and the intro sweep stay off under reduced motion.
 */
function ProfileCardImpl({
  name,
  title,
  status,
  avatarUrl,
  contactHref,
  contactText = "Contact",
  theme = "light",
  radius = 16,
  holo = 0.8,
  glare = 0.5,
  enableTilt = true,
  tiltStrength = 12,
  parallax = 8,
  intro = true,
  className,
}: ProfileCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const engine = useRef<{ write: () => void } | null>(null);
  const settings = useRef({ enableTilt, tiltStrength, parallax, intro });

  useEffect(() => {
    settings.current = { enableTilt, tiltStrength, parallax, intro };
    engine.current?.write();
  }, [enableTilt, tiltStrength, parallax, intro]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const size = { width: root.offsetWidth, height: root.offsetHeight };
    const x = { p: 0, v: 0, target: 0 };
    const y = { p: 0, v: 0, target: 0 };
    const light = { p: 0, target: 0 };
    let raf = 0;
    let last = 0;
    let slowUntil = 0;
    let touchId: number | null = null;

    const write = () => {
      const { enableTilt: tiltOn, tiltStrength: strength, parallax: depth } = settings.current;
      const angle = tiltOn && !reduced ? strength : 0;
      const tilt = Math.min(1, Math.hypot(x.p, y.p));
      const s = root.style;
      s.setProperty("--pc-light-x", `${((x.p + 1) * 0.5 * size.width).toFixed(1)}px`);
      s.setProperty("--pc-light-y", `${((y.p + 1) * 0.5 * size.height).toFixed(1)}px`);
      s.setProperty("--pc-pointer-x", `${((x.p + 1) * 50).toFixed(2)}%`);
      s.setProperty("--pc-pointer-y", `${((y.p + 1) * 50).toFixed(2)}%`);
      s.setProperty("--pc-band-x", `${(50 + x.p * 15).toFixed(2)}%`);
      s.setProperty("--pc-band-y", `${(50 + y.p * 15).toFixed(2)}%`);
      s.setProperty("--pc-rotate-x", `${(y.p * angle).toFixed(3)}deg`);
      s.setProperty("--pc-rotate-y", `${(-x.p * angle).toFixed(3)}deg`);
      s.setProperty("--pc-shift-x", `${(x.p * (reduced ? 0 : depth)).toFixed(2)}px`);
      s.setProperty("--pc-shift-y", `${(y.p * (reduced ? 0 : depth)).toFixed(2)}px`);
      s.setProperty("--pc-reach", tilt.toFixed(4));
      s.setProperty("--pc-tilt", (tilt * light.p).toFixed(4));
      s.setProperty("--pc-active", light.p.toFixed(4));
    };

    // Spring toward the pointer; stop the loop once everything has settled.
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      const slow = now < slowUntil;
      const stiffness = slow ? 24 : 120;
      const damping = slow ? 9 : 16;
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        for (const axis of [x, y]) {
          axis.v += (stiffness * (axis.target - axis.p) - damping * axis.v) * h;
          axis.p += axis.v * h;
        }
      }
      const tau = light.target > light.p ? 0.18 : slow ? 0.9 : 0.45;
      light.p += (light.target - light.p) * (1 - Math.exp(-dt / tau));
      write();
      const moving =
        Math.abs(x.target - x.p) > 0.0005 ||
        Math.abs(y.target - y.p) > 0.0005 ||
        Math.abs(x.v) > 0.0005 ||
        Math.abs(y.v) > 0.0005 ||
        Math.abs(light.target - light.p) > 0.002;
      if (moving) {
        raf = requestAnimationFrame(frame);
      } else {
        x.p = x.target;
        y.p = y.target;
        light.p = light.target;
        write();
        raf = 0;
      }
    };
    const wake = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const aim = (nx: number, ny: number, on = true) => {
      x.target = clamp(nx, -1, 1);
      y.target = clamp(ny, -1, 1);
      light.target = on ? 1 : 0;
      slowUntil = 0;
      wake();
    };
    const aimAt = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      aim(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
    };
    const release = () => aim(0, 0, false);
    const onEnter = (e: PointerEvent) => e.pointerType === "mouse" && aimAt(e);
    const onMove = (e: PointerEvent) => (e.pointerType === "mouse" || e.pointerId === touchId) && aimAt(e);
    const onLeave = (e: PointerEvent) => e.pointerType === "mouse" && release();
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      touchId = e.pointerId;
      aimAt(e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== touchId) return;
      touchId = null;
      release();
    };

    if (reduced) {
      write();
      return;
    }
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            size.width = root.offsetWidth;
            size.height = root.offsetHeight;
            write();
          });
    observer?.observe(root);
    engine.current = { write };

    if (settings.current.intro) {
      x.p = 0.62;
      y.p = -0.55;
      light.p = 1;
      slowUntil = performance.now() + 1400;
      write();
      wake();
    } else {
      write();
    }

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      engine.current = null;
    };
  }, []);

  const vars = {
    ...THEMES[theme],
    ...DARK_FOIL,
    "--pc-radius": `${Math.max(0, radius)}px`,
    "--pc-backdrop": "linear-gradient(180deg, #4a4740 0%, #22211f 100%)",
    "--pc-holo": clamp(holo, 0, 1),
    "--pc-glare": clamp(glare, 0, 1),
    "--pc-parallax": `${Math.max(0, parallax)}px`,
    "--pc-grain": GRAIN,
    "--pc-pattern": "linear-gradient(#000, #000)",
    "--pc-pattern-size": "100% 100%",
    "--pc-holo-gain": 0.75,
    "--pc-holo-detail": 0,
  } as unknown as CSSProperties;

  return (
    <div ref={rootRef} className={["profile-card", className].filter(Boolean).join(" ")} style={vars}>
      <div className="profile-card__body">
        <div className="profile-card__tile">
          <span className="profile-card__sheen" />
          <span className="profile-card__holo" />
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- portraits may come from any source
            <img className="profile-card__photo" src={avatarUrl} alt={name} loading="lazy" draggable={false} />
          ) : (
            <div className="profile-card__photo profile-card__placeholder" role="img" aria-label={`Photo placeholder: portrait of ${name}`}>
              <span aria-hidden>{initialsOf(name)}</span>
            </div>
          )}
          <span className="profile-card__scrim" />
          <div className="profile-card__info">
            <h3 className="profile-card__name">{name}</h3>
            {title && <p className="profile-card__title">{title}</p>}
          </div>
          <span className="profile-card__tile-rim" />
        </div>

        {(status || contactHref) && (
          <div className="profile-card__footer">
            <div className="profile-card__meta">{status && <span className="profile-card__status">{status}</span>}</div>
            {contactHref && (
              <a className="profile-card__contact" href={contactHref} aria-label={`${contactText} ${name}`}>
                <MailIcon />
                {contactText}
              </a>
            )}
          </div>
        )}

        <span className="profile-card__glare" />
        <span className="profile-card__shade" />
        <span className="profile-card__rim" />
      </div>
    </div>
  );
}

export const ProfileCard = memo(ProfileCardImpl);
