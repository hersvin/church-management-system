import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space } from "../lib/theme";
import type { Tool } from "../lib/tools";
import { Icon, Txt } from "./ui";

/** One row per tool: icon, label, and description. The whole row opens the tool. */
export function ToolList({ tools }: { tools: readonly Tool[] }) {
  return (
    <View style={{ gap: space.sm }}>
      {tools.map((tool) => (
        <Pressable
          key={tool.id}
          accessibilityRole="button"
          accessibilityLabel={tool.label}
          accessibilityHint={tool.description}
          onPress={() =>
            tool.href
              ? router.push(tool.href)
              : router.push({
                  pathname: "/tools/[id]",
                  params: { id: tool.id },
                })
          }
          style={({ pressed }) => [
            styles.row,
            pressed && { backgroundColor: colors.sunk },
          ]}
        >
          <View style={styles.icon}>
            <Icon name={tool.icon} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading">{tool.label}</Txt>
            <Txt variant="small">{tool.description}</Txt>
          </View>
          <Icon name="chevronRight" size={18} color={colors.ink2} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 64,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
