import { StyleSheet, Text, View } from "react-native"
import { alpha, colors, fonts, radius } from "../../lib/theme"

/** The reservation-status badge shared by the guest and admin screens — the same five tones
 *  the web app kept in its `STATUS_STYLE` map. */
const TONE: Record<string, { background: string; color: string }> = {
  booked: { background: alpha.moss(0.1), color: colors.moss500 },
  seated: { background: alpha.ember(0.1), color: colors.ember600 },
  completed: { background: alpha.ink(0.08), color: colors.ink600 },
  cancelled: { background: alpha.rust(0.1), color: colors.rust500 },
  no_show: { background: alpha.rust(0.1), color: colors.rust500 },
}

export function StatusPill({ status }: { status: string }) {
  const tone = TONE[status] ?? { background: alpha.ink(0.08), color: colors.ink600 }
  return (
    <View style={[styles.pill, { backgroundColor: tone.background }]}>
      <Text style={[styles.label, { color: tone.color }]}>{status.replace("_", " ")}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
})
