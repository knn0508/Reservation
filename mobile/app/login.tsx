import { useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { Link, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "../src/hooks/useAuth"
import { ApiError } from "../src/lib/api"
import { Button, Card, ErrorNote, Eyebrow, Hint, Input, Label, Screen, Subtitle, Title } from "../src/components/ui"
import { colors } from "../src/lib/theme"

/**
 * One login for both phone roles.
 *
 * The server decides what the account is; the app just routes on the role it gets back.
 * A separate "courier login" screen would only be a second door to the same lock, and one
 * more thing for a courier to get wrong at the start of a shift.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { login } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  async function handleSubmit() {
    setError(null)
    setBusy(true)
    try {
      const user = await login({ email: email.trim(), password })
      if (user.role === "courier") router.replace("/courier")
      else if (user.role === "admin") router.replace("/admin-notice")
      else router.replace("/(customer)/restaurants")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 48 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Text style={styles.brandText}>
              ITB <Text style={styles.brandAccent}>Restaurant</Text> System
            </Text>
          </View>

          <Card style={styles.card}>
            <Eyebrow>Giriş</Eyebrow>
            <Title>Log in</Title>
            <Subtitle>Customers and couriers both sign in here.</Subtitle>

            <View style={styles.field}>
              <Label>Email</Label>
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
            </View>

            <View style={styles.field}>
              <Label>Password</Label>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="••••••••"
              />
            </View>

            {error ? <ErrorNote>{error}</ErrorNote> : null}

            <Button
              title="Log in"
              onPress={handleSubmit}
              loading={busy}
              disabled={!email.trim() || !password}
              style={styles.submit}
            />

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New here?</Text>
              <Link href="/signup" style={styles.link}>
                Create an account
              </Link>
            </View>
            <Hint>Restaurant owners manage their venue on the ITB web dashboard.</Hint>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 24 },
  brand: { alignItems: "center" },
  brandText: { fontSize: 17, color: colors.ink950, letterSpacing: -0.2 },
  brandAccent: { color: colors.ember600, fontStyle: "italic" },
  card: { padding: 22, gap: 4 },
  field: { marginTop: 16 },
  submit: { marginTop: 20 },
  footerRow: { flexDirection: "row", gap: 6, marginTop: 16, justifyContent: "center" },
  footerText: { fontSize: 13, color: colors.ink600 },
  link: { fontSize: 13, color: colors.ember600, fontWeight: "600" },
})
