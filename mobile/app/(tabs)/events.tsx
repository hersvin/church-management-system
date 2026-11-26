import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  TapCard,
  Empty,
  ErrorNote,
  Glyph,
  Loading,
  Screen,
  Txt,
} from "../../src/components/ui";
import { dayHeading, timeOfDay } from "../../src/lib/format";
import {
  useAccount,
  useEvents,
  useLinked,
  useMeMutation,
  type EventItem,
} from "../../src/lib/queries";
import { space } from "../../src/lib/theme";

function EventCard({ e, canRegister }: { e: EventItem; canRegister: boolean }) {
  const register = useMeMutation<{ eventId: string }>(
    "/me/event-registrations",
  );
  const full = e.capacity !== null && e.registered >= e.capacity;
  return (
    <TapCard
      label={`${e.title}, ${dayHeading(e.startsAt)}`}
      onPress={() =>
        router.push({ pathname: "/event/[id]", params: { id: e.id } })
      }
    >
      <Txt variant="data">
        {dayHeading(e.startsAt)} · {timeOfDay(e.startsAt)}
      </Txt>
      <Txt variant="heading">{e.title}</Txt>
      <Txt variant="small">
        {[e.branch.name, e.room?.name, e.ministry?.name]
          .filter(Boolean)
          .join(" · ")}
      </Txt>
      {e.description ? (
        <Txt variant="body" numberOfLines={3}>
          {e.description}
        </Txt>
      ) : null}
      {e.capacity !== null ? (
        <Txt variant="small">
          {e.registered} of {e.capacity} places taken
        </Txt>
      ) : null}
      {e.myRegistrationId ? (
        <View style={styles.row}>
          <Glyph state="done" />
          <Txt variant="small">You are registered</Txt>
        </View>
      ) : e.registrationRequired && !canRegister ? (
        <Txt variant="small">Registration needed.</Txt>
      ) : e.registrationRequired ? (
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
        <Txt variant="small">No registration needed. Just come.</Txt>
      )}
    </TapCard>
  );
}

export default function Events() {
  const events = useEvents();
  const account = useAccount();
  const linked = useLinked();
  const everyBranch = account.data ? account.data.role.key !== "STAFF" : false;
  const ministries = account.data?.ministries.map((m) => m.name).join(", ");
  return (
    <Screen
      refreshing={events.isRefetching}
      onRefresh={() => void events.refetch()}
    >
      <Txt variant="micro">
        {everyBranch ? "Every branch" : "Your ministries"}
      </Txt>
      <Txt variant="title">Events</Txt>
      {!everyBranch && ministries ? (
        <Txt variant="small">Events for {ministries}, at any branch.</Txt>
      ) : null}
      <View style={{ gap: space.md, marginTop: space.xl }}>
        {events.isPending ? <Loading /> : null}
        {events.error ? <ErrorNote message={events.error.message} /> : null}
        {events.data?.length === 0 ? (
          <Empty
            message={
              everyBranch || ministries
                ? "No events coming up."
                : "You are not serving in a ministry yet, so there are no events to show. Ask the church office to add you to one."
            }
          />
        ) : null}
        {events.data?.map((e) => (
          <EventCard key={e.id} e={e} canRegister={linked === true} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
