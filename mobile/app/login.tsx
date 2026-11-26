import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Button, ErrorNote, Icon, Screen, Txt } from "../src/components/ui";
import { useSession } from "../src/lib/session";
import { colors, fonts, radius, space } from "../src/lib/theme";

export default function Login() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.wrap}
      >
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Txt variant="data" style={{ fontSize: 12 }}>
              GC
            </Txt>
          </View>
          <Txt variant="micro">Grace Community Church</Txt>
        </View>
        <Txt variant="title">Welcome back</Txt>
        <Txt variant="small">
          Sign in with the account the church office gave you.
        </Txt>

        <View style={{ gap: space.md, marginTop: space.xl }}>
          <View style={{ gap: space.xs }}>
            <Txt variant="micro" nativeID="email-label">
              Email
            </Txt>
            <TextInput
              accessibilityLabelledBy="email-label"
              accessibilityLabel="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              placeholder="name@example.com"
              placeholderTextColor={colors.ink2}
              style={styles.input}
            />
          </View>
          <View style={{ gap: space.xs }}>
            <Txt variant="micro" nativeID="password-label">
              Password
            </Txt>
            <View style={styles.passwordRow}>
              <TextInput
                accessibilityLabelledBy="password-label"
                accessibilityLabel="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                // Phones must never capitalize or "correct" a password.
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="current-password"
                textContentType="password"
                onSubmitEditing={submit}
                style={[styles.input, styles.passwordInput]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                accessibilityState={{ selected: showPassword }}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={styles.eye}
              >
                <Icon
                  name={showPassword ? "eyeOff" : "eye"}
                  color={colors.ink2}
                />
              </Pressable>
            </View>
          </View>
          {error ? <ErrorNote message={error} /> : null}
          <Button label="Sign in" onPress={submit} busy={busy} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  passwordRow: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 48 },
  eye: {
    position: "absolute",
    right: 0,
    width: 44,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: {
    flex: 1,
    justifyContent: "center",
    gap: space.sm,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.xl,
  },
  mark: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
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
});
