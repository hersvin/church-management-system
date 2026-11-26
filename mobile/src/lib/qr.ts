import { QR_PREFIX } from "@cms/shared";

export type ScanResult =
  { kind: "service" | "member"; token: string } | { kind: "unknown" };

/** React Native (Hermes) and Node both provide atob. */
const decodeBase64Url = (value: string) =>
  atob(value.replace(/-/g, "+").replace(/_/g, "/"));

/**
 * What a scanned code is, read from its payload so the app can route it. The signature is
 * checked by the server; this only decides which screen handles the code.
 */
export function classifyScan(data: string): ScanResult {
  if (!data.startsWith(QR_PREFIX) || data.length > 1000)
    return { kind: "unknown" };
  const body = data.slice(QR_PREFIX.length).split(".")[0];
  try {
    const payload: unknown = JSON.parse(decodeBase64Url(body));
    const type =
      payload && typeof payload === "object" && "t" in payload
        ? payload.t
        : null;
    if (type === "service" || type === "member")
      return { kind: type, token: data };
  } catch {
    // Not a church code.
  }
  return { kind: "unknown" };
}
