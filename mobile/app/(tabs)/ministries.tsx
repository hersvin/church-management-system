import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import {
  Button,
  Card,
  Empty,
  ErrorNote,
  Glyph,
  Loading,
  NotLinkedNote,
  Screen,
  Txt,
} from "../../src/components/ui";
import {
  useLinked,
  useMeMutation,
  useMinistries,
  type MinistryItem,
} from "../../src/lib/queries";
import { colors, fonts, radius, space } from "../../src/lib/theme";

const CATEGORY: Record<string, string> = {
  WORSHIP: "Worship",
  CHILDREN: "Children",
  YOUTH: "Youth",
  ADULTS: "Adults",
  OUTREACH: "Outreach",
  PRAYER: "Prayer",
  HOSPITALITY: "Hospitality",
  MEDIA: "Media",
  OTHER: "Other",
};

function MinistryCard({ m, canJoin }: { m: MinistryItem; canJoin: boolean }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const join = useMeMutation<{ ministryId: string; note?: string }>(
    "/me/ministry-requests",
  );

  return (
    <Card>
      <Txt variant="micro">
        {CATEGORY[m.category] ?? m.category} · {m.branch.name}
      </Txt>
      <Txt variant="heading">{m.name}</Txt>
      {m.meetingSchedule ? (
        <Txt variant="small">{m.meetingSchedule}</Txt>
      ) : null}
      {m.description ? (
        <Txt variant="body" numberOfLines={3}>
          {m.description}
        </Txt>
      ) : null}

      {m.status === "SERVING" ? (
        <View style={styles.row}>
          <Glyph state="done" />
          <Txt variant="small">You serve here</Txt>
        </View>
      ) : m.status === "PENDING" ? (
        <View style={styles.row}>
          <Glyph state="active" />
          <Txt variant="small">Asked to join. A leader will reply.</Txt>
        </View>
      ) : !canJoin ? null : asking ? (
        <View style={{ gap: space.sm }}>
          <TextInput
            accessibilityLabel={`Note for the ${m.name} leaders (optional)`}
            placeholder="A note for the leaders (optional)"
            placeholderTextColor={colors.ink2}
            value={note}
            onChangeText={setNote}
            maxLength={300}
            multiline
            style={styles.input}
          />
          {join.error ? <ErrorNote message={join.error.message} /> : null}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button
                label="Send request"
                busy={join.isPending}
                onPress={() =>
                  join.mutate({
                    ministryId: m.id,
                    ...(note.trim() ? { note: note.trim() } : {}),
                  })
                }
              />
            </View>
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setAsking(false)}
            />
          </View>
        </View>
      ) : (
        <Button
          label="Ask to join"
          variant="outline"
          accessibilityLabel={`Ask to join ${m.name}`}
          onPress={() => setAsking(true)}
        />
      )}
    </Card>
  );
}

export default function Ministries() {
  const ministries = useMinistries();
  const linked = useLinked();
  return (
    <Screen
      refreshing={ministries.isRefetching}
      onRefresh={() => void ministries.refetch()}
    >
      <Txt variant="micro">Serve</Txt>
      <Txt variant="title">Ministries</Txt>
      <Txt variant="small">Ask to join and a leader adds you to the team.</Txt>
      <View style={{ gap: space.md, marginTop: space.xl }}>
        {linked === false ? <NotLinkedNote /> : null}
        {ministries.isPending ? <Loading /> : null}
        {ministries.error ? (
          <ErrorNote message={ministries.error.message} />
        ) : null}
        {ministries.data?.length === 0 ? (
          <Empty message="No ministries yet." />
        ) : null}
        {ministries.data?.map((m) => (
          <MinistryCard key={m.id} m={m} canJoin={linked === true} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  input: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    padding: space.md,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.paper,
    textAlignVertical: "top",
  },
});
