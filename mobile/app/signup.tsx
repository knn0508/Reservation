import { useState } from "react"
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useAuth } from "../src/hooks/useAuth"
import { ApiError } from "../src/lib/api"
import { colors, fonts } from "../src/lib/theme"
import { Display, ErrorNote, Eyebrow, Field, FramedCard, PrimaryButton, Screen } from "../src/components/ui/Primitives"
import { FadeIn } from "../src/components/ui/FadeIn"
import { PressScale } from "../src/components/ui/Pressable"

export default function SignupScreen() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signup } = useAuth()
  const router = useRouter()
  const { next } = useLocalSearchParams<{ next?: string }>()

  async function handleSubmit() {
    setError(null)
    setIsSubmitting(true)
    try {
      await signup({ full_name: fullName.trim(), email: email.trim(), phone: phone.trim(), password })
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
            <Eyebrow>Get started</Eyebrow>
            <Display size={28} style={{ marginTop: 6 }}>
              Create an account
            </Display>

            <View style={styles.form}>
              <Field label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Field
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                hint="At least 8 characters."
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />

              {error && <ErrorNote>{error}</ErrorNote>}

              <PrimaryButton
                label={isSubmitting ? "Creating account…" : "Sign up"}
                onPress={handleSubmit}
                loading={isSubmitting}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <PressScale onPress={() => router.push("/login")} scaleTo={0.96}>
                <Text style={styles.footerLink}>Log in</Text>
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
