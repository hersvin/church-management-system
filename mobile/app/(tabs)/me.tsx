import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "../../src/components/avatar";
import { ToolList } from "../../src/components/tool-list";
import {
  Button,
  ConfirmModal,
  Icon,
  Card,
  Empty,
  ErrorNote,
  Glyph,
  Loading,
  NotLinkedNote,
  Screen,
  SectionHead,
  Txt,
} from "../../src/components/ui";
import { dayHeading, shortDate, timeOfDay } from "../../src/lib/format";
import {
  useAccount,
  useAttendance,
  useLinked,
  useProfile,
} from "../../src/lib/queries";
import { isUsher, roleLabel } from "../../src/lib/roles";
import { TOOLS } from "../../src/lib/tools";
import { useSession } from "../../src/lib/session";
import { colors, space } from "../../src/lib/theme";

const ROLE: Record<string, string> = {
  HEAD: "Head",
  SPOUSE: "Spouse",
  CHILD: "Child",
  OTHER: "Other",
};
const STATUS: Record<string, string> = {
  VISITOR: "Visitor",
  REGULAR: "Regular",
  MEMBER: "Member",
  INACTIVE: "Inactive",
};
const GENDER: Record<string, string> = { MALE: "Male", FEMALE: "Female" };
const CIVIL: Record<string, string> = {
  SINGLE: "Single",
  MARRIED: "Married",
  WIDOWED: "Widowed",
  SEPARATED: "Separated",
};

/** One label and value line; an empty value shows a dash so the person sees what is still missing. */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.row}>
      <Txt variant="micro">{label}</Txt>
      <Txt
        variant="data"
        style={[styles.value, !value && { color: colors.ink2 }]}
      >
        {value || "Not set"}
      </Txt>
    </View>
  );
}

export default function Me() {
  const { user, signOut } = useSession();
  const profile = useProfile();
  const account = useAccount();
  const linked = useLinked();
  const attendance = useAttendance(linked === true);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const p = profile.data;
  const firstName = p?.firstName ?? user?.firstName ?? "";
  const lastName = p?.lastName ?? user?.lastName ?? "";

  async function confirmSignOut() {
    setSigningOut(true);
    await signOut();
  }

  return (
    <Screen
      refreshing={profile.isRefetching}
      onRefresh={() =>
        void Promise.all([
          profile.refetch(),
          attendance.refetch(),
          account.refetch(),
        ])
      }
    >
      <View style={styles.header}>
        <Txt variant="micro">My profile</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => setConfirming(true)}
          hitSlop={12}
          style={styles.signOut}
        >
          <Icon name="logOut" />
        </Pressable>
      </View>

      <View style={styles.identity}>
        <Avatar firstName={firstName} lastName={lastName} />
        <Txt variant="title" style={{ textAlign: "center" }}>
          {`${firstName} ${lastName}`}
        </Txt>
        <Txt variant="data" style={{ color: colors.ink2 }}>
          {user?.email}
        </Txt>
        {account.data ? (
          <Txt variant="micro">
            {account.data.role.name}
            {account.data.branch && account.data.role.key === "STAFF"
              ? ` · ${account.data.branch.name}`
              : " · All branches"}
          </Txt>
        ) : null}
      </View>

      <ConfirmModal
        visible={confirming}
        title="Sign out?"
        message="You will need your email and password to sign in again. Your QR card stops working on this phone."
        confirmLabel="Sign out"
        busy={signingOut}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void confirmSignOut()}
      />

      {account.data &&
      (account.data.role.key === "STAFF" ||
        account.data.ministries.length > 0) ? (
        <>
          <SectionHead label="Serving" title="Ministries" />
          <Card>
            {account.data.ministries.length === 0 ? (
              <Txt variant="small">
                Not serving in a ministry yet. Ask the church office to add you
                to one.
              </Txt>
            ) : (
              account.data.ministries.map((m) => (
                <View key={m.id} style={styles.ministry}>
                  <Txt variant="heading">{m.name}</Txt>
                  <Row label="Position" value={m.position} />
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}

      {profile.isPending ? <Loading /> : null}
      {linked === false ? (
        <View style={{ marginTop: space.lg }}>
          <NotLinkedNote />
        </View>
      ) : profile.error ? (
        <ErrorNote message={profile.error.message} />
      ) : null}

      {p ? (
        <>
          <SectionHead label="Church" title="Membership" />
          <Card>
            <Row label="Status" value={STATUS[p.status] ?? p.status} />
            <Row label="Home branch" value={p.branch.name} />
            <Row
              label="Member since"
              value={p.membershipDate ? shortDate(p.membershipDate) : null}
            />
            <Row
              label="Baptized"
              value={p.baptismDate ? shortDate(p.baptismDate) : null}
            />
          </Card>

          <SectionHead label="About me" title="Profile" />
          <Card>
            <Row
              label="Full name"
              value={[p.firstName, p.middleName, p.lastName, p.suffix]
                .filter(Boolean)
                .join(" ")}
            />
            <Row label="Email" value={p.email} />
            <Row label="Phone" value={p.phone} />
            <Row label="Address" value={p.address} />
            <Row
              label="Birthday"
              value={p.birthDate ? shortDate(p.birthDate) : null}
            />
            <Row label="Gender" value={GENDER[p.gender] ?? null} />
            <Row
              label="Civil status"
              value={
                p.civilStatus ? (CIVIL[p.civilStatus] ?? p.civilStatus) : null
              }
            />
            <Row label="Occupation" value={p.occupation} />
            <View style={{ marginTop: space.sm }}>
              <Button
                label="Edit profile"
                variant="outline"
                onPress={() => router.push("/edit-profile")}
              />
            </View>
          </Card>

          {p.household ? (
            <>
              <SectionHead label="Household" title={p.household.name} />
              <Card>
                {p.household.members.map((m) => (
                  <View key={m.id} style={styles.row}>
                    <Txt variant="body">
                      {m.firstName} {m.lastName}
                    </Txt>
                    <Txt variant="small">
                      {m.householdRole ? ROLE[m.householdRole] : ""}
                    </Txt>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {linked === false && user ? (
        <>
          <SectionHead label="Account" title="Staff account" />
          <Card>
            <Row label="Name" value={`${user.firstName} ${user.lastName}`} />
            <Row label="Email" value={user.email} />
            <Row
              label="Role"
              value={account.data?.role.name ?? roleLabel(user.roleKey)}
            />
            <Row
              label="Branch"
              value={
                account.data?.branch?.name ??
                (user.branchId ? null : "All branches")
              }
            />
          </Card>
        </>
      ) : null}

      {/* Door tools are only for ushers; everyone else uses the tabs. */}
      {isUsher(account.data?.ministries) ? (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Button
            label="Events at my branch"
            variant="outline"
            onPress={() => router.push("/events")}
          />
          <Button
            label="Usher mode"
            variant="outline"
            onPress={() => router.push("/usher")}
          />
        </View>
      ) : null}

      {linked === true ? (
        <>
          <SectionHead
            label="Attendance"
            title={
              attendance.data
                ? `${attendance.data.thisYear} check-ins this year`
                : "Your check-ins"
            }
          />
          {attendance.isPending && !profile.error ? <Loading /> : null}
          {attendance.data?.items.length === 0 ? (
            <Empty message="No check-ins yet. Scan the code at the entrance next Sunday." />
          ) : null}
          {attendance.data?.items.map((a) => {
            const gathering =
              a.service ??
              (a.event
                ? {
                    name: a.event.title,
                    startsAt: a.event.startsAt,
                    branch: a.event.branch,
                  }
                : null);
            if (!gathering) return null;
            return (
              <View key={a.id} style={styles.entry}>
                <Glyph state="done" />
                <View style={{ flex: 1 }}>
                  <Txt variant="body">{gathering.name}</Txt>
                  <Txt variant="small">
                    {dayHeading(gathering.startsAt)} ·{" "}
                    {timeOfDay(gathering.startsAt)} · {gathering.branch.name}
                  </Txt>
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      <SectionHead label="Tools" title="Tools" />
      <ToolList tools={TOOLS} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  signOut: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -space.sm,
  },
  ministry: { gap: space.xs, paddingVertical: space.xs },
  identity: { alignItems: "center", gap: space.xs, marginTop: space.md },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.xs,
  },
  value: { flexShrink: 1, textAlign: "right" },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
});
