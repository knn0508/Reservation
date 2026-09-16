import { Redirect } from "expo-router"
import { View } from "react-native"
import { useAuth } from "../src/hooks/useAuth"
import { Loading, Screen } from "../src/components/ui"

/**
 * The only job of the entry route: send each account to its own app.
 *
 * Customers and couriers are the two surfaces that live on the phone. Restaurant owners
 * run the web dashboard - if an admin account signs in here there is nothing for it to do,
 * so it is told where to go instead of being dropped into a half-working shell.
 */
export default function Index() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Loading />
        </View>
      </Screen>
    )
  }

  if (!user) return <Redirect href="/login" />
  if (user.role === "courier") return <Redirect href="/courier" />
  if (user.role === "admin") return <Redirect href="/admin-notice" />
  return <Redirect href="/(customer)/restaurants" />
}
