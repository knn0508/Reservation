import { useState } from "react"
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "../../src/hooks/useAuth"
import { ApiError } from "../../src/lib/api"
import {
  Display,
  ErrorNote,
  Eyebrow,
  Field,
  FramedCard,
  PrimaryButton,
  Screen,
} from "../../src/components/ui/Primitives"
import { FadeIn } from "../../src/components/ui/FadeIn"

export default function AdminLoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  async function handleSubmit() {
    setError(null)
    setIsSubmitting(true)
    try {
      const user = await login({ email: email.trim(), password })
      if (user.role !== "admin") {
        setError("This account is not an admin account.")
        return
      }
      router.replace("/admin")
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
            <Eyebrow>Staff access</Eyebrow>
            <Display size={28} style={{ marginTop: 6 }}>
              Admin login
            </Display>

            <View style={styles.form}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
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
})
