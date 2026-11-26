import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fonts, radius, space } from "../lib/theme";

type Variant =
  "title" | "heading" | "body" | "small" | "micro" | "data" | "dataLarge";

const textStyles: Record<Variant, TextStyle> = {
  title: {
    fontFamily: fonts.sansBold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  heading: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  small: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink2,
  },
  micro: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.ink2,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  data: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
  },
  dataLarge: {
    fontFamily: fonts.monoMedium,
    fontSize: 28,
    lineHeight: 32,
    color: colors.ink,
  },
};

export function Txt({
  variant = "body",
  style,
  ...props
}: TextProps & { variant?: Variant }) {
  return <Text {...props} style={[textStyles[variant], style]} />;
}

/** A page: paper background, safe-area padding, pull to refresh. */
export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={colors.ink}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  busy,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonOutline,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.paper : colors.ink} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: primary ? colors.paper : colors.ink },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export type GlyphState = "done" | "active" | "waiting" | "off" | "failed";

/** Ink glyphs for state, like the admin app: done filled, active half, waiting empty, off dashed, failed red. */
export function Glyph({
  state,
  size = 12,
}: {
  state: GlyphState;
  size?: number;
}) {
  const color =
    state === "failed"
      ? colors.signal
      : state === "off"
        ? colors.ink2
        : colors.ink;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {state === "done" || state === "failed" ? (
        <Circle cx={6} cy={6} r={5} fill={color} />
      ) : state === "active" ? (
        <>
          <Circle
            cx={6}
            cy={6}
            r={4.5}
            stroke={color}
            strokeWidth={1.2}
            fill="none"
          />
          <Path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill={color} />
        </>
      ) : (
        <Circle
          cx={6}
          cy={6}
          r={4.5}
          stroke={color}
          strokeWidth={1.2}
          fill="none"
          strokeDasharray={state === "off" ? "2 1.6" : undefined}
        />
      )}
      {state === "failed" && (
        <Path d="M4 4l4 4M8 4l-4 4" stroke={colors.paper} strokeWidth={1.3} />
      )}
    </Svg>
  );
}

export function Divider() {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.hairline,
        marginVertical: space.md,
      }}
    />
  );
}

export function Loading() {
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: "center" }}>
      <ActivityIndicator color={colors.ink} />
    </View>
  );
}

/** A failure message: the one place the signal red appears. */
export function ErrorNote({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <Glyph state="failed" />
      <Txt variant="small" style={{ color: colors.signal, flex: 1 }}>
        {message}
      </Txt>
    </View>
  );
}

/** Shown in place of member-only actions on accounts without a member record. */
export function NotLinkedNote() {
  return (
    <View style={styles.empty}>
      <Txt variant="small" style={{ textAlign: "center" }}>
        This account is not linked to a member record, so it can browse but not
        check in, join, or register. Ask the church office to link it.
      </Txt>
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Txt variant="small">{message}</Txt>
    </View>
  );
}

export function SectionHead({
  label,
  title,
}: {
  label?: string;
  title: string;
}) {
  return (
    <View style={{ marginTop: space.xl, marginBottom: space.md, gap: 2 }}>
      {label ? <Txt variant="micro">{label}</Txt> : null}
      <Txt variant="heading">{title}</Txt>
    </View>
  );
}

const ICON_PATHS = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  scan: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  pin: "M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  play: "M8 5v14l11-7z",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2",
  close: "M6 6l12 12M18 6 6 18",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff:
    "M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  logOut: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  wrench:
    "M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7V20h3.3l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7",
  note: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5",
  chevronRight: "M9 6l6 6-6 6",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  copy: "M8 8h11v11H8zM5 16V5h11",
  trash: "M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  pause: "M8 5v14M16 5v14",
  music:
    "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  plus: "M12 5v14M5 12h14",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
} as const;

export type IconName = keyof typeof ICON_PATHS;

/** Thin-stroke line icons in ink, sized like the admin's Rune icons. */
export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Path
        d={ICON_PATHS[name]}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={name === "play" ? color : "none"}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },
  card: {
    backgroundColor: colors.raised,
    borderColor: colors.hairline,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  button: {
    minHeight: 44,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.ink },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: "transparent",
  },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 15 },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.signal,
    backgroundColor: colors.raised,
  },
  empty: {
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.hairline,
    alignItems: "center",
  },
});

/**
 * A centered paper dialog that asks before a consequential action, for example signing out.
 * The confirm button is the filled ink one; Cancel and the back gesture both close it.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={modalStyles.backdrop}>
        <View
          style={modalStyles.dialog}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Txt variant="heading">{title}</Txt>
          <Txt variant="small">{message}</Txt>
          <View style={modalStyles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={onCancel}
                disabled={busy}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={confirmLabel} onPress={onConfirm} busy={busy} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 19, 16, 0.45)",
    justifyContent: "center",
    padding: space.xl,
  },
  dialog: {
    backgroundColor: colors.paper,
    borderColor: colors.ink,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.xl,
    gap: space.sm,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
});

/** A labelled paper text field in the app's style. */
export function Input({
  label,
  id,
  style,
  ...props
}: TextInputProps & { label?: string; id?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Txt variant="micro" nativeID={id}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        accessibilityLabelledBy={label ? id : undefined}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={colors.ink2}
        style={[
          inputStyles.input,
          props.multiline && inputStyles.multiline,
          style,
        ]}
        {...props}
      />
    </View>
  );
}

/** Single-choice chips; the filled ink chip is the choice, so state never depends on color. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <View
      style={inputStyles.chips}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={[inputStyles.chip, on && inputStyles.chipOn]}
          >
            <Txt
              variant="small"
              style={{ color: on ? colors.paper : colors.ink }}
            >
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const inputStyles = StyleSheet.create({
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.raised,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
  },
  multiline: { minHeight: 72, paddingTop: space.sm, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radius.sm,
  },
  chipOn: { backgroundColor: colors.ink },
});

/** A card that opens a detail screen: the whole card is the button, with a chevron as the cue. */
export function TapCard({
  onPress,
  label,
  children,
  style,
}: {
  onPress: () => void;
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the details"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        tapStyles.row,
        pressed && { backgroundColor: colors.sunk },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: space.sm }}>{children}</View>
      <Icon name="chevronRight" size={18} color={colors.ink2} />
    </Pressable>
  );
}

const tapStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
});
