import { useState } from "react"
import * as Location from "expo-location"
import { StyleSheet, Text, View } from "react-native"
import { Button, Hint, Input, Label } from "./ui"
import { colors, radius } from "../lib/theme"
import { formatLatLng, openPlace, parseLatLng, type LatLng } from "../lib/maps"

type GeoState = "idle" | "locating" | "denied" | "failed" | "done"

interface LocationPickerProps {
  value: LatLng | null
  onChange: (value: LatLng) => void
}

/**
 * Drops the delivery pin.
 *
 * On a phone the GPS is the honest primary input, so it leads: one tap and the pin is on
 * the customer's actual door. Pasting a Google Maps link is the fallback for ordering to
 * someone else's address, and typing coordinates is the last resort.
 *
 * There is no draggable in-app map here on purpose - react-native-maps needs a Google Maps
 * API key per platform and a native rebuild. "Check on Google Maps" opens the real app,
 * which the customer already trusts to show them where the pin landed.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [geoState, setGeoState] = useState<GeoState>("idle")
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [pasted, setPasted] = useState("")
  const [pasteError, setPasteError] = useState<string | null>(null)

  async function useMyLocation() {
    setGeoState("locating")
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        setGeoState("denied")
        return
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      setAccuracy(pos.coords.accuracy ?? null)
      setGeoState("done")
    } catch {
      setGeoState("failed")
    }
  }

  function applyPasted(text: string) {
    setPasted(text)
    if (!text.trim()) {
      setPasteError(null)
      return
    }
    const parsed = parseLatLng(text)
    if (parsed) {
      onChange(parsed)
      setPasteError(null)
    } else {
      // A maps.app.goo.gl short link carries no coordinates until it is opened, so say so
      // rather than leaving the customer retrying the same paste.
      setPasteError(
        "No coordinates in that. Open the short link in Google Maps first, then copy the full URL — or just tap “Use my current location”.",
      )
    }
  }

  return (
    <View style={styles.wrap}>
      <Button
        title={geoState === "locating" ? "Finding you…" : "Use my current location"}
        onPress={useMyLocation}
        loading={geoState === "locating"}
      />

      {geoState === "denied" && (
        <Text style={styles.warn}>
          Location permission was refused. Paste a Google Maps link below, or enable location
          for ITB in your phone's settings.
        </Text>
      )}
      {geoState === "failed" && (
        <Text style={styles.warn}>
          Couldn't get a fix. Step near a window or paste a Google Maps link below.
        </Text>
      )}

      {value ? (
        <View style={styles.pinBox}>
          <View style={styles.pinRow}>
            <View style={styles.dot} />
            <Text style={styles.pinCoord}>{formatLatLng(value)}</Text>
          </View>
          {accuracy != null && geoState === "done" && (
            <Text style={styles.pinAccuracy}>Accurate to about {Math.round(accuracy)} m</Text>
          )}
          <Button
            title="Check this pin on Google Maps"
            variant="outline"
            onPress={() => void openPlace(value)}
            style={styles.checkButton}
          />
        </View>
      ) : (
        <View style={[styles.pinBox, styles.pinBoxEmpty]}>
          <Text style={styles.pinEmptyText}>
            No pin yet. The courier navigates by this pin, so it matters more than the street
            name.
          </Text>
        </View>
      )}

      <View>
        <Label>Or paste a Google Maps link</Label>
        <Input
          value={pasted}
          onChangeText={applyPasted}
          placeholder="https://www.google.com/maps/@40.37911,49.85668 — or 40.37911, 49.85668"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {pasteError ? <Text style={styles.warn}>{pasteError}</Text> : null}
        <Hint>In Google Maps, long-press your door → Share → copy the link.</Hint>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  warn: { color: colors.rust500, fontSize: 12, lineHeight: 18, marginTop: 6 },
  pinBox: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.parchment100,
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  pinBoxEmpty: { borderStyle: "dashed" },
  pinRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.moss500 },
  pinCoord: { fontSize: 15, color: colors.ink950, fontVariant: ["tabular-nums"] },
  pinAccuracy: { fontSize: 12, color: colors.ink600 },
  pinEmptyText: { fontSize: 13, lineHeight: 19, color: colors.ink600 },
  checkButton: { marginTop: 6 },
})
