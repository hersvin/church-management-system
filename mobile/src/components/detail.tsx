import type { ReactNode } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space } from "../lib/theme";
import { Icon, Txt, type IconName } from "./ui";

/** The back link and small label above a detail screen's title. */
export function DetailTop({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.top}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        hitSlop={12}
      >
        <Txt variant="data">← Back</Txt>
      </Pressable>
      <Txt variant="micro">{label}</Txt>
    </View>
  );
}

/** One fact with an icon: when, where, who. Extra lines sit under the main value. */
export function DetailRow({
  icon,
  label,
  value,
  children,
}: {
  icon: IconName;
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Icon name={icon} size={18} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="micro">{label}</Txt>
        <Txt variant="body">{value}</Txt>
        {children}
      </View>
    </View>
  );
}

/** Opens the branch address in the phone's maps app; only the church's own address is sent. */
export function MapLink({ address }: { address: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${address} in maps`}
      onPress={() =>
        void Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        )
      }
      hitSlop={8}
      style={styles.link}
    >
      <Txt variant="small">{address}</Txt>
      <Txt variant="data">Directions →</Txt>
    </Pressable>
  );
}

export function PhoneLink({ phone }: { phone: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Call ${phone}`}
      onPress={() =>
        void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`)
      }
      hitSlop={8}
    >
      <Txt variant="data">Call {phone}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.md,
  },
  row: { flexDirection: "row", gap: space.md, paddingVertical: space.sm },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { gap: 2, minHeight: 44, justifyContent: "center" },
});
