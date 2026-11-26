import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { QrCardView } from "../src/components/qr-card";
import { Icon, Screen, Txt } from "../src/components/ui";

/** The QR card as a modal, opened from Home. */
export default function QrCardScreen() {
  return (
    <Screen>
      <View style={styles.top}>
        <Txt variant="micro">Member card</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Icon name="close" />
        </Pressable>
      </View>
      <QrCardView />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
