import Constants from "expo-constants";
import { Platform } from "react-native";
import { resolveApiUrl } from "./api-url";

/** The church API address; see resolveApiUrl for how it is chosen. */
export const API_URL = resolveApiUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  platform: Platform.OS,
});
