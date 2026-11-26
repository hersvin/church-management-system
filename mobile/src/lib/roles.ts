/** The ministry whose members work the door. */
export const USHER_MINISTRY = "usher";

type Served = readonly { name: string }[] | undefined;

/** Ushers are staff serving in the Usher ministry: their Scan tab is the camera for member cards. */
export const isUsher = (ministries: Served) =>
  Boolean(
    ministries?.some((m) => m.name.trim().toLowerCase() === USHER_MINISTRY),
  );

export interface ScanTab {
  mode: "scanner" | "card";
  title: string;
  icon: "scan" | "qr";
}

/** What the middle tab is for this account: the usher's camera, or the person's own QR card for everyone else. */
export function scanTab(ministries: Served): ScanTab {
  return isUsher(ministries)
    ? { mode: "scanner", title: "Scan", icon: "scan" }
    : { mode: "card", title: "My QR", icon: "qr" };
}

/** ADMIN becomes "Admin". */
export function roleLabel(roleKey: string): string {
  const words = roleKey.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
