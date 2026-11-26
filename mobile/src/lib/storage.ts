import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "cms.session";

/**
 * The session token lives in the device keystore (Keychain or Keystore). The web preview, used
 * only for development, falls back to session storage, which clears when the tab closes.
 */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (Platform.OS === "web")
      return globalThis.sessionStorage?.getItem(KEY) ?? null;
    return SecureStore.getItemAsync(KEY);
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === "web")
      return void globalThis.sessionStorage?.setItem(KEY, token);
    await SecureStore.setItemAsync(KEY, token);
  },
  async clear(): Promise<void> {
    if (Platform.OS === "web")
      return void globalThis.sessionStorage?.removeItem(KEY);
    await SecureStore.deleteItemAsync(KEY);
  },
};
