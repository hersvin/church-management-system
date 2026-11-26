import { router, useLocalSearchParams } from "expo-router";
import { createElement } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Empty, Icon, Txt } from "../../src/components/ui";
import { shortDate } from "../../src/lib/format";
import { useVideos } from "../../src/lib/queries";
import { colors, radius, space } from "../../src/lib/theme";
import { embedUrl, isVideoId, watchUrl } from "../../src/lib/youtube";

/** YouTube refuses embeds that arrive with no referrer, so the app names itself. */
const REFERRER = "https://org.gracechurch.app";

/** The official YouTube player: plays here count as channel views, and its full-screen button goes edge to edge. */
function Player({ id }: { id: string }) {
  if (Platform.OS === "web") {
    return createElement("iframe", {
      src: embedUrl(id),
      title: "YouTube video player",
      allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
      allowFullScreen: true,
      style: { width: "100%", height: "100%", border: 0 },
    });
  }
  return (
    <WebView
      source={{ uri: embedUrl(id), headers: { Referer: REFERRER } }}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      // Only YouTube's own pages load inside the player; anything else opens outside the app.
      originWhitelist={["https://www.youtube.com", "https://m.youtube.com"]}
      onShouldStartLoadWithRequest={(req) => {
        if (
          /^https:\/\/(www|m)\.youtube\.com\/embed\//.test(req.url) ||
          req.url === "about:blank"
        )
          return true;
        void Linking.openURL(req.url);
        return false;
      }}
      style={{ backgroundColor: colors.ink }}
    />
  );
}

export default function Watch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const videos = useVideos();
  const valid = isVideoId(id);
  const video = videos.data?.videos.find((v) => v.id === id);
  const upNext = videos.data?.videos.filter((v) => v.id !== id) ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Txt variant="data">← Back</Txt>
        </Pressable>
        <Txt variant="micro">Sunday messages</Txt>
      </View>

      <View style={styles.player}>{valid ? <Player id={id} /> : null}</View>

      <ScrollView contentContainerStyle={styles.content}>
        {!valid ? <Empty message="This video could not be found." /> : null}
        {video ? (
          <>
            <Txt variant="heading">{video.title}</Txt>
            <Txt variant="small">{shortDate(video.publishedAt)}</Txt>
          </>
        ) : null}
        {valid ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(watchUrl(id))}
            style={styles.outLink}
          >
            <Icon name="play" size={14} />
            <Txt variant="data">
              Open in YouTube to like, comment, or subscribe
            </Txt>
          </Pressable>
        ) : null}

        {upNext.length > 0 ? (
          <Txt variant="micro" style={{ marginTop: space.lg }}>
            Up next
          </Txt>
        ) : null}
        {upNext.map((v) => (
          <Pressable
            key={v.id}
            accessibilityRole="button"
            accessibilityLabel={`Play ${v.title}`}
            onPress={() =>
              router.replace({ pathname: "/watch/[id]", params: { id: v.id } })
            }
            style={styles.row}
          >
            <Image
              source={{ uri: v.thumbnail }}
              style={styles.thumb}
              accessibilityIgnoresInvertColors
            />
            <View style={{ flex: 1 }}>
              <Txt variant="body" numberOfLines={2}>
                {v.title}
              </Txt>
              <Txt variant="small">{shortDate(v.publishedAt)}</Txt>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  player: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.ink },
  content: { padding: space.lg, gap: space.xs, paddingBottom: space.xxl * 2 },
  outLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.sm,
    minHeight: 44,
  },
  row: {
    flexDirection: "row",
    gap: space.md,
    marginTop: space.md,
    alignItems: "center",
  },
  thumb: {
    width: 128,
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    backgroundColor: colors.sunk,
  },
});
