import { Redirect, Tabs } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { View } from "react-native"
import { useAuth } from "../../src/hooks/useAuth"
import { Loading, Screen } from "../../src/components/ui"
import { colors } from "../../src/lib/theme"

/** Gate + shell for everything a customer does. A courier or owner who somehow lands on a
 * customer URL is bounced back to the entry route, which knows where they belong. */
export default function CustomerLayout() {
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
  if (user.role !== "customer") return <Redirect href="/" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ember600,
        tabBarInactiveTintColor: colors.ink600,
        tabBarStyle: {
          backgroundColor: colors.parchment50,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.parchment50 },
      }}
    >
      <Tabs.Screen
        name="restaurants"
        options={{
          title: "Restaurants",
          tabBarIcon: ({ color, size }) => <Feather name="grid" color={color} size={size - 3} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, size }) => <Feather name="calendar" color={color} size={size - 3} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Delivery",
          tabBarIcon: ({ color, size }) => <Feather name="truck" color={color} size={size - 3} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size - 3} />,
        }}
      />
    </Tabs>
  )
}
