import { Link, router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  TapCard,
  Empty,
  ErrorNote,
  Glyph,
  Icon,
  Loading,
  Screen,
  SectionHead,
  Txt,
} from "../../src/components/ui";
import { dayHeading, shortDate, timeOfDay } from "../../src/lib/format";
import { useEvents, useServices, useVideos } from "../../src/lib/queries";
import { useSession } from "../../src/lib/session";
import { colors, radius, space } from "../../src/lib/theme";

export default function Home() {
  const { user } = useSession();
  const services = useServices();
  const events = useEvents();
  const videos = useVideos();
  const next = services.data?.find((s) => s.myCampus) ?? services.data?.[0];
  const latest = videos.data?.videos[0];

  return (
    <Screen
      refreshing={services.isRefetching}
      onRefresh={() =>
        void Promise.all([
          services.refetch(),
          events.refetch(),
          videos.refetch(),
        ])
      }
    >
      <Txt variant="micro">Grace Community Church</Txt>
      <Txt variant="title" style={{ marginTop: space.xs }}>
        Welcome, {user?.firstName}
      </Txt>

      <SectionHead label="Next service" title={next ? next.name : "Services"} />
      {services.isPending ? (
        <Loading />
      ) : services.error ? (
        <ErrorNote message={services.error.message} />
      ) : next ? (
        <TapCard
          label={`${next.name}, ${dayHeading(next.startsAt)}`}
          onPress={() =>
            router.push({ pathname: "/service/[id]", params: { id: next.id } })
          }
        >
          <View style={styles.row}>
            <Glyph state={next.checkedIn ? "done" : "waiting"} />
            <Txt variant="data">
              {dayHeading(next.startsAt)} · {timeOfDay(next.startsAt)}
            </Txt>
          </View>
          <Txt variant="small">
            {next.branch.name}
            {next.branch.address ? ` · ${next.branch.address}` : ""}
          </Txt>
          {next.checkedIn ? (
            <Txt variant="small" style={{ color: colors.ink }}>
              You are checked in. Welcome.
            </Txt>
          ) : (
            <Button
              label="Show my QR to check in"
              onPress={() => router.navigate("/scan")}
            />
          )}
        </TapCard>
      ) : (
        <Empty message="No services in the next two weeks." />
      )}

      <SectionHead label="Watch" title="Sunday messages" />
      {latest ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Watch ${latest.title}`}
          onPress={() =>
            router.push({ pathname: "/watch/[id]", params: { id: latest.id } })
          }
        >
          <View style={styles.video}>
            <Image
              source={{ uri: latest.thumbnail }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <View style={styles.play}>
              <Icon name="play" color={colors.ink} size={20} />
            </View>
          </View>
          <Txt variant="heading" style={{ marginTop: space.sm }}>
            {latest.title}
          </Txt>
          <Txt variant="small">
            Latest message · {shortDate(latest.publishedAt)}
          </Txt>
        </Pressable>
      ) : videos.isPending ? (
        <Loading />
      ) : (
        <Empty message="Messages appear here once the church's YouTube channel is reachable." />
      )}
      {videos.data?.videos.slice(1, 4).map((v) => (
        <Pressable
          key={v.id}
          accessibilityRole="link"
          accessibilityLabel={`Watch ${v.title}`}
          onPress={() =>
            router.push({ pathname: "/watch/[id]", params: { id: v.id } })
          }
          style={styles.videoRow}
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

      <SectionHead label="Coming up" title="Events" />
      {events.data?.slice(0, 3).map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={`${e.title}, ${dayHeading(e.startsAt)}`}
          accessibilityHint="Opens the details"
          onPress={() =>
            router.push({ pathname: "/event/[id]", params: { id: e.id } })
          }
          style={({ pressed }) => [
            styles.eventRow,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Glyph state={e.myRegistrationId ? "done" : "waiting"} />
          <View style={{ flex: 1 }}>
            <Txt variant="body">{e.title}</Txt>
            <Txt variant="small">
              {dayHeading(e.startsAt)} · {timeOfDay(e.startsAt)}
            </Txt>
          </View>
          <Icon name="chevronRight" size={18} color={colors.ink2} />
        </Pressable>
      ))}
      {events.data?.length === 0 ? (
        <Empty message="No events coming up." />
      ) : null}
      <Link href="/events" style={styles.link}>
        <Txt variant="data">See all events →</Txt>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  video: {
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  play: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  videoRow: {
    flexDirection: "row",
    gap: space.md,
    marginTop: space.md,
    alignItems: "center",
  },
  thumb: {
    width: 112,
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  link: { marginTop: space.md },
});
