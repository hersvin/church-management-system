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
import { checkInWindow, dayHeading, timeOfDay } from "../../src/lib/format";
import { useAccount, useLinked, useServiceDetail } from "../../src/lib/queries";
import { isUsher } from "../../src/lib/roles";
import { colors, space } from "../../src/lib/theme";

/** One service: when and where, the check-in window, notes from the office, and the person's own check-in. */
export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const service = useServiceDetail(id);
  const account = useAccount();
  const linked = useLinked();
  const s = service.data;
  const usher = isUsher(account.data?.ministries);
  const finished = s ? Date.now() > Date.parse(s.checkInClosesAt) : false;

  return (
    <Screen
      refreshing={service.isRefetching}
      onRefresh={() => void service.refetch()}
    >
      <DetailTop label="Service" onBack={() => router.back()} />
      {service.isPending ? <Loading /> : null}
      {service.error ? <ErrorNote message={service.error.message} /> : null}
      {s ? (
        <>
          <Txt variant="micro">
            {s.myCampus ? "Your branch" : s.branch.name}
          </Txt>
          <Txt variant="title">{s.name}</Txt>

          <Card style={{ marginTop: space.lg }}>
            <DetailRow
              icon="calendar"
              label="When"
              value={dayHeading(s.startsAt)}
            >
              <Txt variant="small">{timeOfDay(s.startsAt)}</Txt>
            </DetailRow>
            <Divider />
            <DetailRow icon="pin" label="Where" value={s.branch.name}>
              {s.branch.address ? <MapLink address={s.branch.address} /> : null}
              {s.branch.phone ? <PhoneLink phone={s.branch.phone} /> : null}
            </DetailRow>
            <Divider />
            <DetailRow
              icon="clock"
              label="Check-in"
              value={checkInWindow(s.checkInOpensAt, s.checkInClosesAt)}
            >
              {s.checkIns !== undefined ? (
                <Txt variant="small">
                  {s.checkIns} {s.checkIns === 1 ? "person" : "people"} checked
                  in so far
                </Txt>
              ) : null}
            </DetailRow>
          </Card>

          {s.notes ? (
            <View style={{ marginTop: space.lg, gap: space.xs }}>
              <Txt variant="micro">From the church office</Txt>
              <Txt variant="body">{s.notes}</Txt>
            </View>
          ) : null}

          <View style={{ marginTop: space.xl, gap: space.sm }}>
            {s.checkedIn ? (
              <View style={styles.state}>
                <Glyph state="done" />
                <Txt variant="body">
                  You are checked in
                  {s.checkedInAt ? ` since ${timeOfDay(s.checkedInAt)}` : ""}
                </Txt>
              </View>
            ) : null}
            {usher && !finished ? (
              <Button
                label="Scan member cards for this service"
                onPress={() =>
                  router.push({
                    pathname: "/usher",
                    params: { serviceId: s.id },
                  })
                }
              />
            ) : null}
            {!usher && !s.checkedIn && !finished && linked === true ? (
              <Button
                label="Show my QR to check in"
                variant="outline"
                onPress={() => router.navigate("/scan")}
              />
            ) : null}
            {finished && !s.checkedIn ? (
              <Txt variant="small" style={{ color: colors.ink2 }}>
                This service has finished.
              </Txt>
            ) : null}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
