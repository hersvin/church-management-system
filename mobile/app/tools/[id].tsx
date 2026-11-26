import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, Empty, Icon, Screen, Txt } from "../../src/components/ui";
import { space } from "../../src/lib/theme";
import { findTool } from "../../src/lib/tools";

/** The screen each tool opens. Placeholder until each tool gets its own content. */
export default function ToolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tool = findTool(id);

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
      {tool ? (
        <>
          <View style={styles.head}>
            <Icon name={tool.icon} size={28} />
            <Txt variant="micro">Tool</Txt>
          </View>
          <Txt variant="title">{tool.label}</Txt>
          <Txt variant="small">{tool.description}</Txt>
          <Card style={{ marginTop: space.xl }}>
            <Txt variant="heading">Coming soon</Txt>
            <Txt variant="small">This tool is not built yet.</Txt>
          </Card>
        </>
      ) : (
        <View style={{ marginTop: space.lg }}>
          <Empty message="This tool could not be found." />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.md,
  },
});
