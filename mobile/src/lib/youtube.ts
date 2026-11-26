const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** YouTube video IDs are 11 URL-safe characters; anything else never reaches the player. */
export const isVideoId = (value: unknown): value is string =>
  typeof value === "string" && VIDEO_ID.test(value);

/**
 * The official embedded player. Plays through it count as views on the church's YouTube channel.
 * `fs=1` keeps the full-screen button; `playsinline=1` plays in the page until the viewer chooses full screen.
 */
export const embedUrl = (id: string) =>
  `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&fs=1`;

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
