import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, space } from "../lib/theme";
import { Button, Txt } from "./ui";

/**
 * Camera QR reader. Reports each distinct code once; the same code is ignored for a few seconds so
 * one scan never sends two requests. `paused` stops reading while the caller handles a code.
 */
export function Scanner({
  onCode,
  paused,
}: {
  onCode: (data: string) => void;
  paused: boolean;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const last = useRef<{ data: string; at: number } | null>(null);

  if (!permission) return <View style={styles.frame} />;
  if (!permission.granted) {
    return (
      <View style={[styles.frame, styles.center]}>
        <Txt
          variant="body"
          style={{ color: colors.paper, textAlign: "center" }}
        >
          The camera reads the check-in code. Nothing is recorded or stored.
        </Txt>
        <Button
          label={
            permission.canAskAgain
              ? "Allow camera"
              : "Allow the camera in Settings"
          }
          onPress={() => void requestPermission()}
          variant="outline"
        />
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={
          paused
            ? undefined
            : ({ data }) => {
                const now = Date.now();
                if (
                  last.current &&
                  last.current.data === data &&
                  now - last.current.at < 4000
                )
                  return;
                last.current = { data, at: now };
                onCode(data);
              }
        }
      />
      <View pointerEvents="none" style={styles.reticle} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 1,
    width: "100%",
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.ink,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.lg,
  },
  reticle: {
    position: "absolute",
    top: "18%",
    left: "18%",
    right: "18%",
    bottom: "18%",
    borderWidth: 2,
    borderColor: colors.paper,
    borderRadius: radius.md,
  },
});
