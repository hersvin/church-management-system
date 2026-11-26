import type { MinistryCategory, MinistryPosition } from "@cms/shared";
import { type AppIcon, GiftIcon, GlobeIcon, GroupIcon, HandIcon, MicIcon, PuzzleIcon, SparklesIcon, TagIcon, VideoIcon } from "@/components/icons";

export const CATEGORY_META: Record<MinistryCategory, { label: string; icon: AppIcon; accent: string }> = {
  WORSHIP: { label: "Worship", icon: MicIcon, accent: "bg-foreground" },
  CHILDREN: { label: "Children", icon: PuzzleIcon, accent: "bg-foreground" },
  YOUTH: { label: "Youth", icon: SparklesIcon, accent: "bg-foreground" },
  ADULTS: { label: "Adults", icon: GroupIcon, accent: "bg-foreground" },
  OUTREACH: { label: "Outreach", icon: GlobeIcon, accent: "bg-foreground" },
  PRAYER: { label: "Prayer", icon: HandIcon, accent: "bg-foreground" },
  HOSPITALITY: { label: "Hospitality", icon: GiftIcon, accent: "bg-foreground" },
  MEDIA: { label: "Media", icon: VideoIcon, accent: "bg-foreground" },
  OTHER: { label: "Other", icon: TagIcon, accent: "bg-foreground" },
};

export const POSITION_LABELS: Record<MinistryPosition, string> = {
  LEADER: "Leader",
  COLEADER: "Co-leader",
  MEMBER: "Member",
};

export function leadersLine(
  leaders: { position: MinistryPosition; member: { firstName: string; lastName: string } }[],
): string {
  if (leaders.length === 0) return "No leader assigned";
  return `Led by ${leaders.map((l) => `${l.member.firstName} ${l.member.lastName}`).join(", ")}`;
}
