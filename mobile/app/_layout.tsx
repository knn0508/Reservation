import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AuthProvider } from "../src/hooks/useAuth"
import { CartProvider } from "../src/hooks/useCart"
import { colors } from "../src/lib/theme"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A phone loses and regains connectivity constantly; refetching when the app comes
      // back to the foreground is what keeps an order board from showing stale state.
      retry: 1,
      staleTime: 5000,
    },
  },
})

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.parchment50 },
              }}
            />
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
