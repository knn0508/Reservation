import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "../src/hooks/useAuth"
import { Button, Card, Eyebrow, Screen, Subtitle, Title } from "../src/components/ui"

/** An owner who signs in on the phone lands here rather than in an empty shell: the
 * dashboard, floor plan and analytics are web surfaces and stay that way. */
export default function AdminNoticeScreen() {
  const { logout } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  async function handleLogout() {
    await logout()
    router.replace("/login")
  }

  return (
    <Screen>
      <View style={[styles.wrap, { paddingTop: insets.top + 60 }]}>
        <Card style={styles.card}>
          <Eyebrow>Restoran sahibi</Eyebrow>
          <Title>Owners work on the web</Title>
          <Subtitle>
            The floor plan, the reservation board, the menu and the sales dashboard all live in
            the ITB web app. This phone app is for customers ordering delivery and for couriers
            carrying it.
          </Subtitle>
          <Button title="Log out" onPress={handleLogout} style={styles.button} />
        </Card>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20 },
  card: { padding: 24 },
  button: { marginTop: 24 },
})
