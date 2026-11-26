/** The account photo address; the version changes with every upload so phones never show a stale cached photo. */
export function photoUrl(
  apiUrl: string,
  version: string | null,
): string | null {
  return version ? `${apiUrl}/me/photo?v=${encodeURIComponent(version)}` : null;
}

/** Up to two capital letters for the placeholder circle. */
export function initials(firstName: string, lastName: string): string {
  const letters = [firstName, lastName]
    .map((n) => n.trim().charAt(0).toUpperCase())
    .join("");
  return letters || "?";
}
