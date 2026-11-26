import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import {
  Button,
  ErrorNote,
  Loading,
  NotLinkedNote,
  Screen,
  Txt,
} from "../src/components/ui";
import {
  birthDateError,
  changedFields,
  toForm,
  type ProfileForm,
} from "../src/lib/profile-form";
import {
  useMeMutation,
  useProfile,
  type MemberProfile,
} from "../src/lib/queries";
import { colors, fonts, radius, space } from "../src/lib/theme";

const GENDERS = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "UNSPECIFIED", label: "Prefer not to say" },
];
const CIVIL = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "WIDOWED", label: "Widowed" },
  { value: "SEPARATED", label: "Separated" },
];

function Field({
  label,
  id,
  ...input
}: { label: string; id: string } & TextInputProps) {
  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="micro" nativeID={id}>
        {label}
      </Txt>
      <TextInput
        accessibilityLabelledBy={id}
        accessibilityLabel={label}
        placeholderTextColor={colors.ink2}
        style={[styles.input, input.multiline && styles.multiline]}
        {...input}
      />
    </View>
  );
}

/** Single-choice chips: a filled ink chip marks the choice, so state never depends on color. */
function Choice({
  label,
  options,
  value,
  onChange,
  clearable,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (next: string | null) => void;
  clearable?: boolean;
}) {
  return (
    <View
      style={{ gap: space.xs }}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      <Txt variant="micro">{label}</Txt>
      <View style={styles.chips}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(selected && clearable ? null : o.value)}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Txt
                variant="small"
                style={{ color: selected ? colors.paper : colors.ink }}
              >
                {o.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function EditForm({ profile }: { profile: MemberProfile }) {
  const [form, setForm] = useState<ProfileForm>(() => toForm(profile));
  const [error, setError] = useState<string | null>(null);
  const save = useMeMutation<Record<string, string | null>, MemberProfile>(
    "/me/member",
    "PATCH",
  );
  const set =
    <K extends keyof ProfileForm>(key: K) =>
    (value: ProfileForm[K]) =>
      setForm((f) => ({ ...f, [key]: value }));

  const dateProblem = birthDateError(form.birthDate);
  const patch = changedFields(form, profile);
  const dirty = Object.keys(patch).length > 0;

  async function submit() {
    if (dateProblem) return setError(dateProblem);
    setError(null);
    try {
      await save.mutateAsync(patch);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    }
  }

  return (
    <View style={{ gap: space.md, marginTop: space.lg }}>
      <Field
        id="email"
        label="Email"
        value={form.email}
        onChangeText={set("email")}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        placeholder="name@example.com"
      />
      <Field
        id="phone"
        label="Phone"
        value={form.phone}
        onChangeText={set("phone")}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="0917 000 0000"
      />
      <Field
        id="address"
        label="Address"
        value={form.address}
        onChangeText={set("address")}
        multiline
        autoComplete="street-address"
        placeholder="Street, barangay, city"
      />
      <Field
        id="occupation"
        label="Occupation"
        value={form.occupation}
        onChangeText={set("occupation")}
        placeholder="Teacher"
      />
      <Field
        id="birth"
        label="Birthday (YYYY-MM-DD)"
        value={form.birthDate}
        onChangeText={set("birthDate")}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        placeholder="1990-04-12"
        maxLength={10}
      />
      {dateProblem && form.birthDate.length >= 10 ? (
        <Txt variant="small">{dateProblem}</Txt>
      ) : null}
      <Choice
        label="Gender"
        options={GENDERS}
        value={form.gender}
        onChange={(v) => set("gender")(v ?? "UNSPECIFIED")}
      />
      <Choice
        label="Civil status"
        options={CIVIL}
        value={form.civilStatus}
        onChange={set("civilStatus")}
        clearable
      />

      {error ? <ErrorNote message={error} /> : null}
      <Button
        label="Save changes"
        onPress={() => void submit()}
        busy={save.isPending}
        disabled={!dirty}
      />
      <Button label="Cancel" variant="outline" onPress={() => router.back()} />
      <Txt variant="small">
        To change your name, status, branch, or household, ask the church
        office.
      </Txt>
    </View>
  );
}

export default function EditProfile() {
  const profile = useProfile();
  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Txt variant="micro">My profile</Txt>
        <Txt variant="title">Edit details</Txt>
        {profile.isPending ? <Loading /> : null}
        {profile.error ? <NotLinkedNote /> : null}
        {profile.data ? <EditForm profile={profile.data} /> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.raised,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
  },
  multiline: { minHeight: 72, paddingTop: space.sm, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radius.sm,
  },
  chipOn: { backgroundColor: colors.ink },
});
