import { StyleSheet, View } from "react-native"
import { useQuery } from "@tanstack/react-query"
import { useLocalSearchParams } from "expo-router"
import { getRestaurants } from "../../../src/lib/api"
import { BookingWizard } from "../../../src/components/booking/BookingWizard"
import { RequireAuth } from "../../../src/components/auth/RequireAuth"
import { Display, Eyebrow, FramedCard, LoadingScreen, Screen } from "../../../src/components/ui/Primitives"
import { FadeIn } from "../../../src/components/ui/FadeIn"

function BookingInner() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurant = restaurants.data?.find((r) => r.slug === slug)

  if (restaurants.isLoading) return <LoadingScreen />
  if (!restaurant) return <LoadingScreen label="Restaurant not found." />

  return (
    <Screen>
      {/* Heading only. The floor plan is the widest thing in the wizard, so the screen gives it
          every vertical inch it can — the web page dropped its intro copy for the same reason. */}
      <View style={styles.intro}>
        <Eyebrow>Reserving at</Eyebrow>
        <Display size={34} style={{ marginTop: 6 }}>
          {restaurant.name}
        </Display>
      </View>

      <FadeIn offset={16} duration={550} style={{ marginTop: 20 }}>
        <FramedCard>
          <BookingWizard restaurantId={restaurant.id} restaurantSlug={restaurant.slug} />
        </FramedCard>
      </FadeIn>
    </Screen>
  )
}

export default function BookingScreen() {
  return (
    <RequireAuth role="customer">
      <BookingInner />
    </RequireAuth>
  )
}

const styles = StyleSheet.create({
  intro: {
    paddingTop: 24,
  },
})
