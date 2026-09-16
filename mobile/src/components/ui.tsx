import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native"
import { colors, radius } from "../lib/theme"

/** The handful of primitives every screen needs, so no screen re-invents a button. */

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{children}</Text>
    </View>
  )
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="rgba(122,110,99,0.6)"
      {...props}
      style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
    />
  )
}

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: "primary" | "outline" | "ghost"
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
}: ButtonProps) {
  const isPrimary = variant === "primary"
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary && styles.buttonPrimary,
        variant === "outline" && styles.buttonOutline,
        variant === "ghost" && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        // A 0.98 scale on press is the web app's tactile signature; keep it here too.
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.parchment50 : colors.ink800} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isPrimary ? styles.buttonTextPrimary : styles.buttonTextDark,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  )
}

export function Pill({
  label,
  tone = "neutral",
}: {
  label: string
  tone?: "neutral" | "ember" | "moss" | "rust"
}) {
  const toneStyle =
    tone === "ember"
      ? { bg: colors.tintEmber, fg: colors.ember600 }
      : tone === "moss"
        ? { bg: colors.tintMoss, fg: colors.moss500 }
        : tone === "rust"
          ? { bg: colors.tintRust, fg: colors.rust500 }
          : { bg: "rgba(36,30,25,0.06)", fg: colors.ink700 }
  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.bg }]}>
      <Text style={[styles.pillText, { color: toneStyle.fg }]}>{label}</Text>
    </View>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  )
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.ember600} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment50 },
  card: {
    backgroundColor: colors.parchment100,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ember600,
  },
  title: { fontSize: 30, color: colors.ink950, marginTop: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.ink600, marginTop: 8 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink600,
  },
  hint: { fontSize: 12, lineHeight: 18, color: "rgba(122,110,99,0.85)", marginTop: 6 },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.parchment100,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink950,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: "top" },
  errorBox: {
    borderWidth: 1,
    borderColor: "rgba(180,68,46,0.35)",
    backgroundColor: colors.tintRust,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: colors.rust500, fontSize: 13, lineHeight: 19 },
  button: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonPrimary: { backgroundColor: colors.ink950 },
  buttonOutline: { borderWidth: 1, borderColor: colors.lineStrong },
  buttonGhost: { backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { transform: [{ scale: 0.98 }] },
  buttonText: { fontSize: 14, fontWeight: "600" },
  buttonTextPrimary: { color: colors.parchment50 },
  buttonTextDark: { color: colors.ink800 },
  // alignSelf keeps the pill sized to its text. Without it, a row parent whose alignItems
  // defaults to `stretch` makes the pill as tall as the tallest sibling, and a 999 radius
  // turns that tall box into a blob with the label floating in it.
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { fontSize: 11, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 17, color: colors.ink950 },
  emptyBody: { fontSize: 13, lineHeight: 20, color: colors.ink600, textAlign: "center" },
  loading: { paddingVertical: 48, alignItems: "center" },
})
