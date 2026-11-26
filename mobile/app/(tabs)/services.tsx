import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import {
  TapCard,
  Empty,
  ErrorNote,
  Glyph,
  Loading,
  Screen,
  SectionHead,
  Txt,
} from "../../src/components/ui";
import { groupByDay, timeOfDay } from "../../src/lib/format";
import { useServices } from "../../src/lib/queries";
import { space } from "../../src/lib/theme";

export default function Services() {
  const services = useServices();
  const groups = groupByDay(services.data ?? []);

  return (
    <Screen
      refreshing={services.isRefetching}
      onRefresh={() => void services.refetch()}
    >
      <Txt variant="micro">Next two weeks</Txt>
      <Txt variant="title">Services</Txt>
      <Txt variant="small">
        Every branch. Your branch is listed first each day.
      </Txt>

      {services.isPending ? <Loading /> : null}
      {services.error ? <ErrorNote message={services.error.message} /> : null}
      {services.data?.length === 0 ? (
        <Empty message="No services scheduled yet." />
      ) : null}

      {groups.map((g) => (
        <View key={g.heading}>
          <SectionHead title={g.heading} />
          <View style={{ gap: space.sm }}>
            {[...g.items]
              .sort((a, b) => Number(b.myCampus) - Number(a.myCampus))
              .map((s) => (
                <TapCard
                  key={s.id}
                  label={`${s.name}, ${timeOfDay(s.startsAt)}, ${s.branch.name}`}
                  onPress={() =>
                    router.push({
                      pathname: "/service/[id]",
                      params: { id: s.id },
                    })
                  }
                >
                  <View style={styles.row}>
                    <Txt variant="dataLarge" style={{ fontSize: 20 }}>
                      {timeOfDay(s.startsAt)}
                    </Txt>
                    {s.checkedIn ? (
                      <View style={styles.row}>
                        <Glyph state="done" />
                        <Txt variant="small">Checked in</Txt>
                      </View>
                    ) : null}
                  </View>
                  <Txt variant="body">{s.name}</Txt>
                  <Txt variant="small">
                    {s.branch.name}
                    {s.myCampus ? " · your branch" : ""}
                  </Txt>
                  {s.branch.address ? (
                    <Txt variant="small">{s.branch.address}</Txt>
                  ) : null}
                </TapCard>
              ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
});
