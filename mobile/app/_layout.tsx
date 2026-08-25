import { useEffect } from "react"
import { View } from "react-native"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "../src/hooks/useAuth"
import { useAppFonts } from "../src/hooks/useAppFonts"
import { SiteHeader } from "../src/components/layout/SiteHeader"
import { colors } from "../src/lib/theme"

// The web app disabled refetch-on-focus; the native equivalent (refetch when the app returns
// from the background) is off by default, so the same defaults carry over.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const fontsLoaded = useAppFonts()

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync()
  }, [fontsLoaded])

  // Every screen styles its own text with a loaded family, so nothing may render until the
  // fonts are in — otherwise the first frame flashes in the system font.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.parchment50 }} />
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" backgroundColor={colors.parchment50} />
          <Stack
            screenOptions={{
              // The floating pill nav replaces the platform header on every screen.
              header: () => <SiteHeader />,
              contentStyle: { backgroundColor: colors.parchment50 },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="my-reservations" />
            <Stack.Screen name="admin/index" />
            <Stack.Screen name="admin/login" />
            <Stack.Screen name="restaurants/[slug]/index" options={{ headerShown: false }} />
            <Stack.Screen name="restaurants/[slug]/book" />
            {/* The menu is its own world, with its own back link — same as the web route. */}
            <Stack.Screen name="restaurants/[slug]/menu" options={{ headerShown: false }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
