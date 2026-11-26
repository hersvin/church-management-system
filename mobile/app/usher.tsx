import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { UsherScanner } from "../src/components/usher-scanner";
import { Screen, Txt } from "../src/components/ui";
import { space } from "../src/lib/theme";

/** Usher mode opened from the Me tab; the same scanner is the Scan tab for ushers. */
export default function Usher() {
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Txt variant="data">← Back</Txt>
      </Pressable>
      <View style={{ marginTop: space.md }}>
        <UsherScanner initialServiceId={serviceId ?? null} />
      </View>
    </Screen>
  );
}
