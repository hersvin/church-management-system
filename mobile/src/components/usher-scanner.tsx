import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { timeOfDay } from "../lib/format";
import { useStaffServices } from "../lib/queries";
import { classifyScan } from "../lib/qr";
import { useSession } from "../lib/session";
import { colors, radius, space } from "../lib/theme";
import { Scanner } from "./scanner";
import { Card, Empty, ErrorNote, Glyph, Loading, Txt } from "./ui";

type Scanned = {
  id: string;
  member: { firstName: string; lastName: string } | null;
};
type LogEntry = { key: string; text: string; ok: boolean };

/**
 * Ushers pick a service, then scan members' QR cards. The normal check-in rules apply on the server.
 * `active` keeps the camera off while the screen is not showing.
 */
export function UsherScanner({
  active = true,
  initialServiceId = null,
}: {
  active?: boolean;
  /** Opens straight on this service, for example from the service detail screen. */
  initialServiceId?: string | null;
}) {
  const { api, can } = useSession();
  const services = useStaffServices(can("attendance.manage"));
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId);
  const [log, setLog] = useState<LogEntry[]>([]);
  const add = (entry: LogEntry) => setLog((l) => [entry, ...l].slice(0, 8));
  const scan = useMutation({
    mutationFn: (token: string) =>
      api.request<Scanned>(`/services/${serviceId}/check-ins/scan`, {
        method: "POST",
        json: { token },
      }),
    onSuccess: (r) =>
      add({
        key: r.id,
        text: `${r.member?.firstName ?? ""} ${r.member?.lastName ?? ""} checked in`,
        ok: true,
      }),
    onError: (e) =>
      add({ key: String(Date.now()), text: e.message, ok: false }),
  });
  const service = services.data?.find((s) => s.id === serviceId);

  function onCode(data: string) {
    const code = classifyScan(data);
    if (code.kind === "member") scan.mutate(code.token);
    else
      add({
        key: String(Date.now()),
        text: "That is not a member card.",
        ok: false,
      });
  }

  return (
    <>
      <Txt variant="micro">Usher mode</Txt>
      <Txt variant="title">{service ? service.name : "Choose a service"}</Txt>

      {!service ? (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          {services.isPending ? <Loading /> : null}
          {services.error ? (
            <ErrorNote message={services.error.message} />
          ) : null}
          {services.data?.length === 0 ? (
            <Empty message="No services today in your branch." />
          ) : null}
          {services.data?.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`Scan for ${s.name}`}
              onPress={() => setServiceId(s.id)}
              style={styles.choice}
            >
              <Txt variant="dataLarge" style={{ fontSize: 18 }}>
                {timeOfDay(s.startsAt)}
              </Txt>
              <View style={{ flex: 1 }}>
                <Txt variant="body">{s.name}</Txt>
                <Txt variant="small">
                  {s.branch.name} · {s.checkIns} checked in
                </Txt>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          {active ? <Scanner onCode={onCode} paused={scan.isPending} /> : null}
          <Card>
            <Txt variant="micro">Last scans</Txt>
            {log.length === 0 ? (
              <Txt variant="small">Scan a member card.</Txt>
            ) : null}
            {log.map((entry) => (
              <View
                key={entry.key}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                }}
              >
                <Glyph state={entry.ok ? "done" : "failed"} />
                <Txt
                  variant="body"
                  style={entry.ok ? undefined : { color: colors.signal }}
                >
                  {entry.text}
                </Txt>
              </View>
            ))}
          </Card>
          <Pressable
            accessibilityRole="button"
            onPress={() => setServiceId(null)}
          >
            <Txt variant="data">Change service</Txt>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
});
