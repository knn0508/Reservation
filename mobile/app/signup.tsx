import { useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { Link, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "../src/hooks/useAuth"
import { ApiError } from "../src/lib/api"
import { Button, Card, ErrorNote, Eyebrow, Hint, Input, Label, Screen, Subtitle, Title } from "../src/components/ui"
import { colors } from "../src/lib/theme"

/** Self-registration creates customers only. Courier accounts are issued by the restaurant
 * from the web dashboard - a delivery job is not something you grant yourself. */
export default function SignupScreen() {
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { signup } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const canSubmit =
    fullName.trim().length > 0 && phone.trim().length > 0 && email.trim().length > 0 && password.length >= 8

  async function handleSubmit() {
    setError(null)
    setBusy(true)
    try {
      await signup({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone: phone.trim(),
      })
      router.replace("/(customer)/restaurants")
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
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.card}>
            <Eyebrow>Qeydiyyat</Eyebrow>
            <Title>Create an account</Title>
            <Subtitle>Order delivery and follow it to your door.</Subtitle>

            <View style={styles.field}>
              <Label>Full name</Label>
              <Input value={fullName} onChangeText={setFullName} placeholder="Leyla Məmmədova" />
            </View>

            <View style={styles.field}>
              <Label>Phone</Label>
              <Input
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+994 50 123 45 67"
              />
              <Hint>The courier calls this number when they arrive.</Hint>
            </View>

            <View style={styles.field}>
              <Label>Email</Label>
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
            </View>

            <View style={styles.field}>
              <Label>Password</Label>
              <Input value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
              <Hint>At least 8 characters.</Hint>
            </View>

            {error ? <ErrorNote>{error}</ErrorNote> : null}

            <Button
              title="Create account"
              onPress={handleSubmit}
              loading={busy}
              disabled={!canSubmit}
              style={styles.submit}
            />

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have one?</Text>
              <Link href="/login" style={styles.link}>
                Log in
              </Link>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  card: { padding: 22 },
  field: { marginTop: 16 },
  submit: { marginTop: 22 },
  footerRow: { flexDirection: "row", gap: 6, marginTop: 16, justifyContent: "center" },
  footerText: { fontSize: 13, color: colors.ink600 },
  link: { fontSize: 13, color: colors.ember600, fontWeight: "600" },
})
