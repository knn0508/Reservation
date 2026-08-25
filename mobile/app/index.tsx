import { useEffect } from "react"
import { Image, StyleSheet, Text, View } from "react-native"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { getRestaurants } from "../src/lib/api"
import { getRestaurantContent } from "../src/lib/restaurantContent"
import { mediaUrl } from "../src/lib/config"
import { useAuth } from "../src/hooks/useAuth"
import { alpha, colors, fonts, radius } from "../src/lib/theme"
import { Body, Display, Screen, Skeleton } from "../src/components/ui/Primitives"
import { FadeIn } from "../src/components/ui/FadeIn"
import { PressScale } from "../src/components/ui/Pressable"

export default function RestaurantsScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })

  // Staff land on the floor view, never the guest list — the web app did this with <Navigate>.
  useEffect(() => {
    if (user?.role === "admin") router.replace("/admin")
  }, [user?.role, router])

  return (
    <Screen>
      <FadeIn offset={24} duration={700} style={styles.intro}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Reservations</Text>
        </View>
        <Display size={40} style={{ marginTop: 18 }}>
          Choose your table,
        </Display>
        <Text style={styles.headlineAccent}>held for tonight.</Text>
        <Body style={{ marginTop: 16, maxWidth: 380 }}>
          Two dining rooms, one account. Pick a restaurant to see real-time table availability and book in under a
          minute.
        </Body>
      </FadeIn>

      <View style={styles.list}>
        {restaurants.isLoading &&
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={288} style={{ marginBottom: 16 }} />)}

        {restaurants.data?.map((r, i) => {
          const content = getRestaurantContent(r.slug)
          const cardImage = mediaUrl(content.images[0])
          return (
            <FadeIn key={r.id} delay={i * 100} offset={32} duration={700} style={styles.cardWrap}>
              <PressScale onPress={() => router.push(`/restaurants/${r.slug}`)} scaleTo={0.985}>
                <View style={styles.tray}>
                  <View style={styles.card}>
                    {cardImage ? (
                      <Image
                        source={{ uri: cardImage }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.cardFallback]}>
                        <Ionicons name="image-outline" size={36} color={alpha.parchment(0.25)} />
                      </View>
                    )}
                    {/* Scrim, so the caption stays readable over any photo. */}
                    <View style={styles.scrim} />

                    <View style={styles.cardBody}>
                      {content.cuisine ? <Text style={styles.cardCuisine}>{content.cuisine}</Text> : null}
                      <Text style={styles.cardName}>{content.displayName}</Text>
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardCta}>View restaurant</Text>
                        <View style={styles.cardArrow}>
                          <Ionicons name="arrow-forward" size={16} color={colors.ink950} />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </PressScale>
            </FadeIn>
          )
        })}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  intro: {
    paddingTop: 28,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.ember(0.25),
    backgroundColor: alpha.ember(0.05),
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ember600,
  },
  headlineAccent: {
    fontFamily: fonts.displayItalic,
    fontSize: 40,
    lineHeight: 44,
    color: colors.ember600,
  },
  list: {
    marginTop: 40,
  },
  cardWrap: {
    marginBottom: 16,
  },
  tray: {
    borderRadius: 32,
    backgroundColor: alpha.ink(0.04),
    borderWidth: 1,
    borderColor: alpha.ink(0.05),
    padding: 8,
  },
  card: {
    height: 300,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: alpha.ink(0.08),
    justifyContent: "flex-end",
    backgroundColor: colors.ink900,
  },
  cardFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink900,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(25,21,18,0.42)",
  },
  cardBody: {
    padding: 24,
  },
  cardCuisine: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: alpha.parchment(0.7),
  },
  cardName: {
    marginTop: 10,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    color: colors.parchment50,
  },
  cardFooter: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardCta: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: alpha.parchment(0.75),
  },
  cardArrow: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.parchment50,
  },
})
