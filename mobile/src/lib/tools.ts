import type { IconName } from "../components/ui";

export interface Tool {
  /** Used in the address: /tools/<id>. */
  id: string;
  label: string;
  description: string;
  icon: IconName;
  /** A tool with its own screens opens here instead of the generic /tools/<id> page. */
  href?: "/music/library";
}

/**
 * The tools listed on the Me tab. Each opens /tools/<id>. These three are placeholders: rename them,
 * reword them, and give each its own screen as the real tools are designed.
 */
export const TOOLS: readonly Tool[] = [
  {
    id: "music-library",
    label: "Music Library",
    description:
      "Search songs, build worship playlists, and set the key for each song.",
    icon: "music",
    href: "/music/library",
  },
  {
    id: "tool-two",
    label: "Tool two",
    description: "Placeholder. This tool is still being designed.",
    icon: "book",
  },
  {
    id: "tool-three",
    label: "Tool three",
    description: "Placeholder. This tool is still being designed.",
    icon: "note",
  },
];

export const findTool = (id: string | undefined) =>
  TOOLS.find((t) => t.id === id);
