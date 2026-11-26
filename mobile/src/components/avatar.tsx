import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { API_URL } from "../lib/config";
import { initials, photoUrl } from "../lib/photo";
import { useAccount, useMeMutation } from "../lib/queries";
import { tokenStore } from "../lib/storage";
import { colors, fonts, radius, space } from "../lib/theme";
import { Button, ErrorNote, Icon, Txt } from "./ui";

const SIZE = 88;
/** Photos are squared and shrunk on the phone first, so uploads stay near 100 KB. */
const PHOTO_PX = 512;

async function pick(source: "library" | "camera") {
  if (source === "camera") {
    const allowed = await ImagePicker.requestCameraPermissionsAsync();
    if (!allowed.granted)
      throw new Error(
        "Camera access is off. Turn it on in your phone settings to take a photo.",
      );
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const image = await ImageManipulator.manipulate(result.assets[0].uri)
    .resize({ width: PHOTO_PX })
    .renderAsync();
  const saved = await image.saveAsync({
    compress: 0.7,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return saved.base64 ?? null;
}

/** The account photo (or initials) with a camera badge; tapping it opens choose, take, or remove. */
export function Avatar({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  const account = useAccount();
  const upload = useMeMutation<{ mimeType: string; data: string }>(
    "/me/photo",
    "PUT",
  );
  const remove = useMeMutation<undefined>("/me/photo", "DELETE");
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;
  const uri = photoUrl(API_URL, account.data?.photoUpdatedAt ?? null);

  useEffect(() => {
    void tokenStore.get().then(setToken);
  }, []);

  async function choose(source: "library" | "camera") {
    setOpen(false);
    setError(null);
    try {
      const data = await pick(source);
      if (data) await upload.mutateAsync({ mimeType: "image/jpeg", data });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not update the photo. Try again.",
      );
    }
  }

  async function clear() {
    setOpen(false);
    setError(null);
    try {
      await remove.mutateAsync(undefined);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not remove the photo. Try again.",
      );
    }
  }

  return (
    <View style={{ alignItems: "center", gap: space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? "Change profile photo" : "Add profile photo"}
        onPress={() => setOpen(true)}
        disabled={busy}
        style={styles.circle}
      >
        {uri && token ? (
          <Image
            source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
            style={styles.image}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Txt style={styles.initials}>{initials(firstName, lastName)}</Txt>
        )}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.paper} />
          </View>
        ) : null}
        <View style={styles.badge}>
          <Icon name="camera" size={16} />
        </View>
      </Pressable>
      {error ? <ErrorNote message={error} /> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close"
        >
          <Pressable
            style={styles.sheet}
            accessibilityViewIsModal
            onPress={() => {}}
          >
            <Txt variant="heading">Profile photo</Txt>
            <Button
              label="Choose from photos"
              onPress={() => void choose("library")}
            />
            <Button
              label="Take a photo"
              variant="outline"
              onPress={() => void choose("camera")}
            />
            {uri ? (
              <Button
                label="Remove photo"
                variant="outline"
                onPress={() => void clear()}
              />
            ) : null}
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.sunk,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: SIZE - 2, height: SIZE - 2, borderRadius: SIZE / 2 },
  initials: { fontFamily: fonts.monoMedium, fontSize: 28, color: colors.ink },
  busy: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
    backgroundColor: "rgba(20, 19, 16, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 19, 16, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.ink,
    padding: space.xl,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
});
