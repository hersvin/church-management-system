import {
  MUSIC_KEYS,
  formatTransposition,
  transposeSemitones,
} from "@cms/shared";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space } from "../../lib/theme";
import { Button, Txt } from "../ui";

/** The 17 key spellings as a grid. The filled chip is the selected key; the outlined double border is the original. */
export function KeyPicker({
  visible,
  title,
  originalKey,
  selectedKey,
  onSelect,
  onClose,
  allowNone,
}: {
  visible: boolean;
  title: string;
  originalKey: string | null;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onClose: () => void;
  /** Lets the person leave the key unset, for a song whose key is not known yet. */
  allowNone?: boolean;
}) {
  const shift = transposeSemitones(originalKey, selectedKey);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable
          style={styles.sheet}
          onPress={() => {}}
          accessibilityViewIsModal
        >
          <Txt variant="micro">Key</Txt>
          <Txt variant="heading" numberOfLines={2}>
            {title}
          </Txt>
          <View style={styles.summary}>
            <Txt variant="data">Original {originalKey ?? "not set"}</Txt>
            <Txt variant="data">Selected {selectedKey ?? "not set"}</Txt>
            <Txt variant="data">
              {originalKey && selectedKey
                ? formatTransposition(shift)
                : "No transposition"}
            </Txt>
          </View>
          <View style={styles.grid} accessibilityRole="radiogroup">
            {MUSIC_KEYS.map((key) => {
              const selected = key === selectedKey;
              const original = key === originalKey;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${key}${original ? ", original key" : ""}`}
                  onPress={() => onSelect(key)}
                  style={[
                    styles.key,
                    original && styles.original,
                    selected && styles.selected,
                  ]}
                >
                  <Txt
                    variant="data"
                    style={{
                      color: selected ? colors.paper : colors.ink,
                      fontSize: 15,
                    }}
                  >
                    {key}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {originalKey ? (
              <Button
                label="Reset to original key"
                variant="outline"
                onPress={() => onSelect(originalKey)}
                disabled={selectedKey === originalKey}
              />
            ) : null}
            {allowNone ? (
              <Button
                label="Key not known"
                variant="outline"
                onPress={() => onSelect(null)}
              />
            ) : null}
            <Button label="Done" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
  },
  key: {
    width: 56,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
  },
  original: { borderColor: colors.ink, borderWidth: 2 },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
});
