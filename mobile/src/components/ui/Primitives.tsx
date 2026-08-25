import { type ReactNode } from "react"
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type TextInputProps,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { alpha, colors, fonts, radius } from "../../lib/theme"
import { PressScale } from "./Pressable"

/** The page shell: parchment background, safe-area padding, scrolling body. */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  bottomInset = 32,
}: {
  children: ReactNode
  scroll?: boolean
  contentStyle?: StyleProp<ViewStyle>
  bottomInset?: number
}) {
  const insets = useSafeAreaInsets()
  const padding = { paddingBottom: insets.bottom + bottomInset }

  if (!scroll) {
    return <View style={[styles.screen, padding, contentStyle]}>{children}</View>
  }
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scrollContent, padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
}

/** The small ember-coloured uppercase label above every heading in the web design. */
export function Eyebrow({ children, tone = "ember" }: { children: ReactNode; tone?: "ember" | "muted" }) {
  return <Text style={[styles.eyebrow, tone === "muted" && { color: colors.ink600 }]}>{children}</Text>
}

export function Display({
  children,
  size = 30,
  style,
}: {
  children: ReactNode
  size?: number
  style?: StyleProp<TextStyle>
}) {
  return <Text style={[styles.display, { fontSize: size, lineHeight: size * 1.1 }, style]}>{children}</Text>
}

export function Body({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}) {
  return (
    <Text style={[styles.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  )
}

/** The web design's signature double frame: a soft outer tray with an inset bordered panel. */
export function FramedCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tray, style]}>
      <View style={styles.trayInner}>{children}</View>
    </View>
  )
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  tone = "ink",
  style,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  tone?: "ink" | "parchment" | "danger"
  style?: StyleProp<ViewStyle>
}) {
  const background =
    tone === "parchment" ? colors.parchment50 : tone === "danger" ? colors.rust500 : colors.ink950
  const foreground = tone === "parchment" ? colors.ink950 : colors.parchment50
  const off = disabled || loading

  return (
    <PressScale onPress={onPress} disabled={off} scaleTo={0.98} style={style}>
      <View style={[styles.primaryButton, { backgroundColor: background, opacity: off ? 0.5 : 1 }]}>
        {loading ? <ActivityIndicator size="small" color={foreground} style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.primaryButtonLabel, { color: foreground }]}>{label}</Text>
      </View>
    </PressScale>
  )
}

export function GhostButton({
  label,
  onPress,
  disabled,
  tone = "ink",
  style,
  icon,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  tone?: "ink" | "danger"
  style?: StyleProp<ViewStyle>
  icon?: ReactNode
}) {
  const color = tone === "danger" ? colors.rust500 : colors.ink800
  const border = tone === "danger" ? alpha.rust(0.3) : alpha.ink(0.15)
  return (
    <PressScale onPress={onPress} disabled={disabled} scaleTo={0.97} style={style}>
      <View style={[styles.ghostButton, { borderColor: border, opacity: disabled ? 0.5 : 1 }]}>
        {icon}
        <Text style={[styles.ghostButtonLabel, { color }]}>{label}</Text>
      </View>
    </PressScale>
  )
}

export function Field({
  label,
  hint,
  style,
  ...inputProps
}: TextInputProps & { label: string; hint?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={alpha.ink(0.32)} {...inputProps} style={styles.input} />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <View style={styles.errorNote}>
      <Text style={styles.errorNoteText}>{children}</Text>
    </View>
  )
}

/** Dashed empty-state box, used wherever the web app showed `border-dashed` placeholder copy. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <View style={styles.emptyNote}>
      <Text style={styles.emptyNoteText}>{children}</Text>
    </View>
  )
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.ember500} />
      <Text style={[styles.body, { marginTop: 12 }]}>{label}</Text>
    </View>
  )
}

/** A rounded placeholder block for list skeletons. */
export function Skeleton({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height, backgroundColor: alpha.ink(0.05), borderRadius: 26 }, style]} />
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.parchment50,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ember600,
  },
  display: {
    fontFamily: fonts.display,
    color: colors.ink950,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink600,
  },
  tray: {
    backgroundColor: alpha.ink(0.04),
    borderRadius: 32,
    padding: 8,
    borderWidth: 1,
    borderColor: alpha.ink(0.05),
  },
  trayInner: {
    backgroundColor: colors.parchment100,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: alpha.ink(0.08),
    padding: 20,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  primaryButtonLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
  },
  ghostButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  ghostButtonLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },
  fieldLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink600,
    marginBottom: 6,
  },
  fieldHint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: alpha.ink(0.45),
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: alpha.ink(0.15),
    backgroundColor: colors.parchment50,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink950,
  },
  errorNote: {
    borderWidth: 1,
    borderColor: alpha.rust(0.3),
    backgroundColor: alpha.rust(0.05),
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorNoteText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.rust500,
  },
  emptyNote: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: alpha.ink(0.18),
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 28,
  },
  emptyNoteText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink600,
    textAlign: "center",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.parchment50,
    padding: 24,
  },
})
