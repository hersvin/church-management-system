import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import {
  DetailRow,
  DetailTop,
  MapLink,
  PhoneLink,
} from "../../src/components/detail";
import {
  Button,
  Card,
  Divider,
  ErrorNote,
  Glyph,
  Loading,
  Screen,
  Txt,
} from "../../src/components/ui";
import { dayHeading, placesLeft, timeRange } from "../../src/lib/format";
import {
  useEventDetail,
  useLinked,
  useMeMutation,
} from "../../src/lib/queries";
import { colors, space } from "../../src/lib/theme";

const CATEGORY: Record<string, string> = {
  SERVICE: "Service",
  CLASS: "Class",
  MEETING: "Meeting",
  FELLOWSHIP: "Fellowship",
  OUTREACH: "Outreach",
  OTHER: "Event",
};

/** Everything about one event: when, where, who runs it, places, and the person's own registration. */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEventDetail(id);
  const linked = useLinked();
  const register = useMeMutation<{ eventId: string }>(
    "/me/event-registrations",
  );
  const e = event.data;
  const cancelled = e?.status === "CANCELLED";
  const ended = e ? Date.parse(e.endsAt) < Date.now() : false;
  const left = e ? placesLeft(e.capacity, e.registered) : null;
  const full = left === "Full";

  return (
    <Screen
      refreshing={event.isRefetching}
      onRefresh={() => void event.refetch()}
    >
      <DetailTop label="Event" onBack={() => router.back()} />
      {event.isPending ? <Loading /> : null}
      {event.error ? <ErrorNote message={event.error.message} /> : null}
      {e ? (
        <>
          <Txt variant="micro">
            {CATEGORY[e.category] ?? "Event"}
            {e.ministry ? ` · ${e.ministry.name}` : ""}
          </Txt>
          <Txt variant="title">{e.title}</Txt>

          {cancelled ? (
            <View style={{ marginTop: space.md }}>
              <ErrorNote
                message={`This event is cancelled.${e.cancelReason ? ` ${e.cancelReason}` : ""}`}
              />
            </View>
          ) : null}

          <Card style={{ marginTop: space.lg }}>
            <DetailRow
              icon="calendar"
              label="When"
              value={dayHeading(e.startsAt)}
            >
              <Txt variant="small">{timeRange(e.startsAt, e.endsAt)}</Txt>
            </DetailRow>
            <Divider />
            <DetailRow
              icon="pin"
              label="Where"
              value={[e.room?.name, e.branch.name].filter(Boolean).join(", ")}
            >
              {e.room?.location ? (
                <Txt variant="small">{e.room.location}</Txt>
              ) : null}
              {e.branch.address ? <MapLink address={e.branch.address} /> : null}
              {e.branch.phone ? <PhoneLink phone={e.branch.phone} /> : null}
            </DetailRow>
            {e.ministry ? (
              <>
                <Divider />
                <DetailRow
                  icon="heart"
                  label="Ministry"
                  value={e.ministry.name}
                />
              </>
            ) : null}
            {e.registrationRequired || e.capacity !== null ? (
              <>
                <Divider />
                <DetailRow
                  icon="user"
                  label="Places"
                  value={
                    e.capacity !== null
                      ? `${e.registered} of ${e.capacity} registered`
                      : `${e.registered} registered`
                  }
                >
                  {left ? <Txt variant="small">{left}</Txt> : null}
                </DetailRow>
              </>
            ) : null}
          </Card>

          {e.description ? (
            <View style={{ marginTop: space.lg, gap: space.xs }}>
              <Txt variant="micro">About</Txt>
              <Txt variant="body">{e.description}</Txt>
            </View>
          ) : null}

          <View style={{ marginTop: space.xl, gap: space.sm }}>
            {e.checkedIn ? (
              <View style={styles.state}>
                <Glyph state="done" />
                <Txt variant="body">You were checked in</Txt>
              </View>
            ) : null}
            {e.myRegistrationId ? (
              <View style={styles.state}>
                <Glyph state="done" />
                <Txt variant="body">You are registered</Txt>
              </View>
            ) : cancelled || ended ? null : e.registrationRequired ? (
              linked === true ? (
                <>
                  {register.error ? (
                    <ErrorNote message={register.error.message} />
                  ) : null}
                  <Button
                    label={full ? "Full" : "Register"}
                    disabled={full}
                    busy={register.isPending}
                    accessibilityLabel={
                      full ? `${e.title} is full` : `Register for ${e.title}`
                    }
                    onPress={() => register.mutate({ eventId: e.id })}
                  />
                </>
              ) : (
                <Txt variant="small">
                  Registration is needed. Ask the church office to link your
                  account to your member record.
                </Txt>
              )
            ) : (
              <Txt variant="small" style={{ color: colors.ink2 }}>
                No registration needed. Just come.
              </Txt>
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
