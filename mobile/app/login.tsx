import { useState } from "react"
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useAuth } from "../src/hooks/useAuth"
import { ApiError } from "../src/lib/api"
import { colors, fonts } from "../src/lib/theme"
import { Display, ErrorNote, Eyebrow, Field, FramedCard, PrimaryButton, Screen } from "../src/components/ui/Primitives"
import { FadeIn } from "../src/components/ui/FadeIn"
import { PressScale } from "../src/components/ui/Pressable"

export default function LoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const router = useRouter()
  const { next } = useLocalSearchParams<{ next?: string }>()

  async function handleSubmit() {
    setError(null)
    setIsSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      router.replace((next ?? "/") as never)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen contentStyle={styles.content}>
        <FadeIn offset={20} duration={550}>
          <FramedCard>
            <Eyebrow>Welcome back</Eyebrow>
            <Display size={28} style={{ marginTop: 6 }}>
              Log in
            </Display>

            <View style={styles.form}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />

              {error && <ErrorNote>{error}</ErrorNote>}

              <PrimaryButton
                label={isSubmitting ? "Logging in…" : "Log in"}
                onPress={handleSubmit}
                loading={isSubmitting}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>No account? </Text>
              <PressScale onPress={() => router.push("/signup")} scaleTo={0.96}>
                <Text style={styles.footerLink}>Sign up</Text>
              </PressScale>
            </View>
          </FramedCard>
        </FadeIn>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: 32,
  },
  form: {
    marginTop: 24,
    gap: 14,
  },
  footer: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink600,
  },
  footerLink: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ember600,
  },
})
