const API_PORT = 4000;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

/**
 * Where the app finds the church API.
 * 1. EXPO_PUBLIC_API_URL, when set (production, or any custom setup).
 * 2. In development on a phone: the computer serving the app (Expo's hostUri), on the API port.
 * 3. Otherwise the emulator (10.0.2.2) or simulator and browser (localhost) defaults.
 */
export function resolveApiUrl({
  envUrl,
  hostUri,
  platform,
}: {
  envUrl?: string;
  hostUri?: string | null;
  platform: string;
}): string {
  if (envUrl) return envUrl;
  const host = hostUri?.split("/")[0]?.split(":")[0];
  if (host && IPV4.test(host) && !host.startsWith("127."))
    return `http://${host}:${API_PORT}`;
  return platform === "android"
    ? `http://10.0.2.2:${API_PORT}`
    : `http://localhost:${API_PORT}`;
}
