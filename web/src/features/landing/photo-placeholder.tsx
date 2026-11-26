import { styles } from "./styles";

export const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

/** Line drawing of the sanctuary arches; stands in for photography until real photos are supplied. */
function Arches() {
  return (
    <svg viewBox="0 0 1000 760" preserveAspectRatio="xMaxYMax slice" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
      <path d="M520 760V330q190-250 380-250t380 250v430" transform="translate(-300 0)" />
      <path d="M620 760V370q140-180 280-180t280 180v390" transform="translate(-300 0)" />
      <path d="M730 760V420q85-110 170-110t170 110v340" transform="translate(-300 0)" />
      <path d="M600 140v90M570 175h60" />
      <path d="M0 760h1000M0 700h1000M0 640h1000" />
    </svg>
  );
}

export function PhotoPlaceholder({ brief, className, labelClassName }: { brief: string; className?: string; labelClassName?: string }) {
  return (
    <div className={cx(styles.photo, className)} role="img" aria-label={`Photo placeholder: ${brief}`}>
      <Arches />
      <p className={cx(styles.photoLabel, labelClassName)} aria-hidden>
        <b>Photo placeholder.</b> {brief}
      </p>
    </div>
  );
}
