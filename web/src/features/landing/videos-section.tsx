"use client";

import type { PublicVideo } from "@cms/shared";
import { useState } from "react";
import { PhotoPlaceholder, cx } from "./photo-placeholder";
import { styles } from "./styles";

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

/** Privacy-enhanced player: YouTube sets no cookies until the visitor plays the video. */
const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;

function PlayMark({ small = false }: { small?: boolean }) {
  return <span className={cx("lp-play", small && "lp-play--small")} aria-hidden />;
}

/**
 * The newest message from the church's YouTube channel, with the next three beside it. Nothing
 * from YouTube loads until a visitor presses play (the thumbnails come from YouTube's image host).
 * Without videos it shows labelled placeholders.
 */
export function VideosSection({ videos, channelUrl }: { videos: readonly PublicVideo[]; channelUrl: string | null }) {
  const [featuredId, setFeaturedId] = useState(videos[0]?.id ?? null);
  const [playing, setPlaying] = useState(false);
  const featured = videos.find((v) => v.id === featuredId) ?? videos[0];

  if (!featured) {
    return (
      <div className="lp-videos">
        <PhotoPlaceholder brief="Latest Sunday message, 16:9 video thumbnail." className="lp-videoFrame" />
        <ul className="lp-videoList" aria-label="Recent videos">
          {["Last week's message", "Midweek prayer", "Youth night worship"].map((t) => (
            <li key={t} className="lp-videoItem">
              <PhotoPlaceholder brief={`${t}, video thumbnail.`} className="lp-videoThumb" />
              <span className="lp-videoTitle">{t}</span>
            </li>
          ))}
        </ul>
        {channelUrl && (
          <a href={channelUrl} className={cx(styles.btn, styles.secondary, "lp-videoAll")} target="_blank" rel="noopener noreferrer">
            See all on YouTube
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="lp-videos">
      <figure className="lp-videoMain">
        <div className="lp-videoFrame">
          {playing ? (
            <iframe
              src={embedUrl(featured.id)}
              title={featured.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <button type="button" className="lp-videoPoster" onClick={() => setPlaying(true)} aria-label={`Play ${featured.title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnails, no image optimizer needed */}
              <img src={featured.thumbnail} alt="" loading="lazy" decoding="async" />
              <PlayMark />
            </button>
          )}
        </div>
        <figcaption>
          <span className="lp-videoTitle lp-videoTitle--main">{featured.title}</span>
          <span className={styles.small}>
            {featured.id === videos[0].id ? "Latest message · " : ""}
            {dateLabel(featured.publishedAt)}
          </span>
          {featured.id !== videos[0].id && (
            <button
              type="button"
              className="lp-videoBack"
              onClick={() => {
                setFeaturedId(videos[0].id);
                setPlaying(false);
              }}
            >
              Back to the latest message
            </button>
          )}
        </figcaption>
      </figure>

      <div className="lp-videoSide">
        <ul className="lp-videoList" aria-label="Recent videos">
          {videos.slice(1, 4).map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="lp-videoItem"
                  aria-label={`Watch ${v.title}, ${dateLabel(v.publishedAt)}`}
                  aria-current={v.id === featuredId ? "true" : undefined}
                  onClick={() => {
                    setFeaturedId(v.id);
                    setPlaying(true);
                  }}
                >
                  <span className="lp-videoThumb">
                    {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnails */}
                    <img src={v.thumbnail} alt="" loading="lazy" decoding="async" />
                    <PlayMark small />
                  </span>
                  <span>
                    <span className="lp-videoTitle">{v.title}</span>
                    <span className={styles.small}>{dateLabel(v.publishedAt)}</span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
        {channelUrl && (
          <a href={channelUrl} className={cx(styles.btn, styles.secondary)} target="_blank" rel="noopener noreferrer">
            See all on YouTube
          </a>
        )}
      </div>
    </div>
  );
}
