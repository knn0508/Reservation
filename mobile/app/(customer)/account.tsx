import { useRouter } from "expo-router"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "../../src/hooks/useAuth"
import { useCart } from "../../src/hooks/useCart"
import { API_BASE } from "../../src/lib/api"
import { Button, Card, Eyebrow, Hint, Screen, Title } from "../../src/components/ui"
import { colors } from "../../src/lib/theme"

export default function AccountScreen() {
  const { user, logout } = useAuth()
  const { count, clear } = useCart()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  async function handleLogout() {
    await logout()
    router.replace("/login")
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <View>
          <Eyebrow>Hesabım</Eyebrow>
          <Title>Account</Title>
        </View>

        <Card style={styles.card}>
          <Row label="Name" value={user?.full_name ?? "—"} />
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Phone" value={user?.phone ?? "—"} />
        </Card>

        <Card style={styles.card}>
          <Row label="Basket" value={count === 0 ? "Empty" : `${count} item${count === 1 ? "" : "s"}`} />
          {count > 0 && <Button title="Empty the basket" variant="outline" onPress={clear} />}
        </Card>

        <Button title="Log out" onPress={handleLogout} />

        {/* Worth showing: on a phone the #1 "nothing loads" cause is the app pointing at the
            wrong dev machine, and this turns that into a one-glance diagnosis. */}
        <Hint>Connected to {API_BASE}</Hint>
      </ScrollView>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  card: { padding: 16, gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  rowLabel: { fontSize: 13, color: colors.ink600 },
  rowValue: { flex: 1, textAlign: "right", fontSize: 14, color: colors.ink950 },
})
