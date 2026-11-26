import type { PublicVideos } from "@cms/shared";
import Link from "next/link";
import {
  type AppIcon,
  GlobeIcon,
  HandIcon,
  HeartIcon,
  MicIcon,
  SparklesIcon,
  UsersIcon,
} from "@/components/icons";
import { FadeIn } from "@/components/motion";
import { formatPeso, LANDING, type MinistryMark } from "./content";
import "./landing.css";
import { GalleryCarousel } from "./gallery-carousel";
import { cx, PhotoPlaceholder } from "./photo-placeholder";
import { Reveal, RevealItem, RevealList } from "./reveal";
import { DriftWall } from "./drift-wall";
import { VideosSection } from "./videos-section";
import { NamesMarquee } from "./names-marquee";
import { ProfileCard } from "./profile-card";
import { styles } from "./styles";
import { MobileMenu } from "./mobile-menu";
import { CipherReveal } from "./cipher-reveal";
import type { LandingContent } from "./live";

const MARKS: Record<MinistryMark, AppIcon> = {
  worship: MicIcon,
  kids: SparklesIcon,
  hospitality: HandIcon,
  youth: UsersIcon,
  prayer: HeartIcon,
  outreach: GlobeIcon,
};

const NO_VIDEOS: PublicVideos = { channelUrl: null, videos: [] };

/** `content` defaults to the written copy; the home page passes it merged with live church data. */
export function LandingPage({
  content = LANDING,
  videos = NO_VIDEOS,
}: { content?: LandingContent; videos?: PublicVideos } = {}) {
  const L = content;
  const ids = L.sectionIds;

  return (
    <div className={styles.page}>
      <p className={styles.announce}>
        <span className={styles.long}>{L.announcement.long}</span>
        <span className={styles.short}>{L.announcement.short}</span>
        <a href={L.announcement.link.href}>{L.announcement.link.label}</a>
      </p>

      <header className={styles.hero}>
        <PhotoPlaceholder
          brief={L.hero.photo}
          className={styles.heroPhoto}
          labelClassName={styles.heroLabel}
        />

        <div className={styles.header}>
          <div className={styles.wrap}>
            <div className={styles.bar}>
              <a
                className={styles.brand}
                href="#top"
                aria-label={`${L.church.name}, home`}
              >
                <span className={styles.mark} aria-hidden />
                {L.church.name}
              </a>
              <nav aria-label="Main" className={styles.nav}>
                {L.nav.map((l) => (
                  <a key={l.href} href={l.href}>
                    {l.label}
                  </a>
                ))}
              </nav>
              <div className={styles.headerActions}>
                <Link href="/login">Staff sign in</Link>
                <a
                  href={L.closing.primary.href}
                  className={cx(styles.btn, styles.primary)}
                >
                  {L.closing.primary.label}
                </a>
                <MobileMenu links={L.nav} cta={L.closing.primary} />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.panelRow} id="top">
          <div className={styles.wrap}>
            <FadeIn y={12} className={styles.panel}>
              <h1 className={styles.display}>
                <CipherReveal text={L.hero.title} />
              </h1>
              <p className={styles.lede}>{L.hero.lede}</p>
              <div className={styles.ctaRow}>
                <a
                  href={L.hero.primary.href}
                  className={cx(styles.btn, styles.primary)}
                >
                  {L.hero.primary.label}
                </a>
                <a
                  href={L.hero.secondary.href}
                  className={cx(styles.btn, styles.secondary)}
                >
                  {L.hero.secondary.label}
                </a>
              </div>
              <ul className={cx(styles.trust, styles.small)}>
                {L.hero.trust.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </FadeIn>
          </div>
        </div>
      </header>

      <main>
        <section
          id={ids.ministries}
          className={cx(styles.band, styles.alt)}
          aria-labelledby="ministries-title"
        >
          {/* <NamesMarquee rows={L.namesOfJesus} label="Names of Jesus" /> */}
          <div className={styles.wrap}>
            <Reveal className={styles.sectionHead}>
              <h2 id="ministries-title" className={styles.h2}>
                {L.ministries.title}
              </h2>
              <p>{L.ministries.caption}</p>
            </Reveal>
          </div>
          {/* Full-bleed band between the heading and the ministries grid. */}
          <div className={styles.wrap}>
            <RevealList className={styles.ruled}>
              {L.ministries.items.map((m) => {
                const Mark = MARKS[m.mark];
                return (
                  <RevealItem key={m.name}>
                    <Mark />
                    <span>
                      <strong>{m.name}</strong>
                      <span className={styles.small}>{m.detail}</span>
                    </span>
                  </RevealItem>
                );
              })}
            </RevealList>
          </div>
        </section>

        <section
          id={ids.life}
          className={styles.band}
          aria-labelledby="life-title"
        >
          <div className={styles.wrap}>
            <Reveal className={styles.sectionHead}>
              <h2 id="life-title" className={styles.h2}>
                A week at Grace.
              </h2>
              <p>
                Sunday is the start. Most of church life happens in rooms like
                these, every day of the week.
              </p>
            </Reveal>
          </div>
          <Reveal y={0} delay={0.1}>
            <GalleryCarousel items={L.gallery} />
          </Reveal>
        </section>

        <section
          id={ids.visit}
          className={cx(styles.band, styles.alt)}
          aria-labelledby="visit-title"
        >
          <div className={styles.wrap}>
            <Reveal className={styles.sectionHead}>
              <h2 id="visit-title" className={styles.h2}>
                Your first Sunday, step by step.
              </h2>
              <p>
                No forms at the door and no spotlight on newcomers. Here is what
                to expect.
              </p>
            </Reveal>
            <div className={styles.process}>
              <RevealList ordered className={styles.steps}>
                {L.steps.map((s, i) => (
                  <RevealItem key={s.title}>
                    <span className={styles.stepNumber} aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className={styles.h3}>
                        <span className="sr-only">Step {i + 1}: </span>
                        {s.title}
                      </h3>
                      <p>{s.body}</p>
                    </div>
                  </RevealItem>
                ))}
              </RevealList>
              <DriftWall
                className={styles.driftWall}
                label="Photos from church life"
                items={L.gallery.map((g) => ({
                  id: g.title,
                  content: (
                    <PhotoPlaceholder
                      brief={g.brief}
                      className={styles.galleryPhoto}
                    />
                  ),
                }))}
                columns={4}
                tileWidth={160}
                tileHeight={116}
                gap={16}
                radius={0}
                speed={26}
                tilt={14}
                turn={-16}
                depth={90}
                parallax={0.5}
                lift={48}
                fade={0.55}
                dim={0.8}
                overlayColor="#e3e1dd"
              />
            </div>
          </div>
        </section>

        <section
          id={ids.team}
          className={styles.band}
          aria-labelledby="team-title"
        >
          <div className={styles.wrap}>
            <Reveal className={styles.centerHead}>
              <h2 id="team-title" className={styles.h2}>
                {L.team.title}
              </h2>
              <p className={styles.small}>{L.team.note}</p>
            </Reveal>
            <RevealList className={styles.teamGrid}>
              {L.team.people.map((p) => (
                <RevealItem key={p.name} className={styles.teamItem}>
                  <ProfileCard
                    name={p.name}
                    title={p.role}
                    status={p.campus}
                    avatarUrl={p.photo}
                    contactHref={`mailto:${L.church.email}?subject=${encodeURIComponent(`For ${p.name}`)}`}
                    theme="light"
                    holo={0.6}
                    glare={0.45}
                    tiltStrength={10}
                  />
                </RevealItem>
              ))}
            </RevealList>
          </div>
        </section>

        <section
          id={ids.rooms}
          className={cx(styles.band, styles.alt)}
          aria-labelledby="rooms-title"
        >
          <div className={styles.wrap}>
            <Reveal className={styles.sectionHead}>
              <h2 id="rooms-title" className={styles.h2}>
                {L.rooms.title}
              </h2>
              <p>{L.rooms.lede}</p>
            </Reveal>
            <RevealList className={styles.plans} aria-label="Room hire plans">
              {L.rooms.plans.map((p) => (
                <RevealItem key={p.name} className={styles.plan}>
                  <div>
                    <h3 className={styles.h3}>{p.name}</h3>
                    <span className={styles.capacity}>
                      Up to {p.capacity} people
                    </span>
                  </div>
                  <div>
                    <p>{p.bestFor}</p>
                    <ul
                      className={styles.includes}
                      aria-label={`${p.name} includes`}
                    >
                      {p.includes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <p className={styles.rate}>
                    {formatPeso(p.ratePerHour)}
                    <span>per hour</span>
                  </p>
                  <a
                    href={L.rooms.action.href}
                    className={cx(styles.btn, styles.secondary)}
                    aria-label={`${L.rooms.action.label} for ${p.name}`}
                  >
                    {L.rooms.action.label}
                  </a>
                </RevealItem>
              ))}
            </RevealList>
            <p className={cx(styles.small, styles.plansNote)}>{L.rooms.note}</p>
          </div>
        </section>

        <section
          id={ids.watch}
          className={styles.band}
          aria-labelledby="watch-title"
        >
          <div className={styles.wrap}>
            <Reveal className={styles.sectionHead}>
              <h2 id="watch-title" className={styles.h2}>
                {L.videos.title}
              </h2>
              <div>
                <p>{L.videos.lede}</p>
                <a
                  className="lp-channel"
                  href={L.videos.channel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="lp-channelMark" aria-hidden />
                  <span>
                    <strong>{L.videos.channel.name}</strong> on YouTube{" "}
                    <span className="lp-channelHandle">
                      {L.videos.channel.handle}
                    </span>
                  </span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </Reveal>
            <Reveal>
              <VideosSection
                videos={videos.videos}
                channelUrl={L.videos.channel.url}
              />
            </Reveal>
          </div>
        </section>

        <section
          className={cx(styles.band, styles.alt)}
          aria-labelledby="closing-title"
        >
          <div className={styles.wrap}>
            <Reveal className={styles.closing}>
              <div>
                <h2 id="closing-title" className={styles.h2}>
                  {L.closing.title}
                </h2>
                <p>Three campuses, four Sunday services, one welcome.</p>
              </div>
              <div className={styles.closingActions}>
                <a
                  href={L.closing.primary.href}
                  className={cx(styles.btn, styles.inverseBtn)}
                >
                  {L.closing.primary.label}
                </a>
                <a
                  href={L.closing.secondary.href}
                  className={cx(styles.btn, styles.inverseGhost)}
                >
                  {L.closing.secondary.label}
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer id={ids.contact} className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.footerGrid}>
            <div id={ids.times}>
              <p className={styles.brand}>
                <span className={styles.mark} aria-hidden />
                {L.church.name}
              </p>
              <p
                className={styles.small}
                style={{ marginTop: 16, maxWidth: "44ch" }}
              >
                {L.footer.blurb}{" "}
                <a href={`mailto:${L.church.email}`}>{L.church.email}</a> ·{" "}
                {L.church.phone}
              </p>
              <div className={styles.campuses}>
                {L.campuses.map((c) => (
                  <div key={c.name}>
                    <strong>{c.name}</strong>
                    <span className={styles.small}>
                      {c.address}
                      <br />
                      {c.services.join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {L.footer.columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2>{col.title}</h2>
                <ul>
                  {col.links.map((l) =>
                    l.href.startsWith("/") ? (
                      <li key={l.label}>
                        <Link href={l.href}>{l.label}</Link>
                      </li>
                    ) : (
                      <li key={l.label}>
                        <a href={l.href}>{l.label}</a>
                      </li>
                    ),
                  )}
                </ul>
              </nav>
            ))}
          </div>
          <div className={cx(styles.footerBase, styles.small)}>
            <p>
              © {L.footer.copyrightYear} {L.church.name}. {L.footer.note}
            </p>
            <ul className={styles.social} aria-label="Social media">
              {L.footer.social.map((s) => (
                <li key={s.label}>
                  <a href={s.href} rel="noopener noreferrer" target="_blank">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
