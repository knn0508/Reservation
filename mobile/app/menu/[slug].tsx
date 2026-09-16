import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { FlatList, Image, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getMyReservations, getRestaurants } from "../../src/lib/api"
import { mediaUrl } from "../../src/lib/media"
import { mamajanMenu, type MenuItem } from "../../src/lib/menu"
import { useCart } from "../../src/hooks/useCart"
import { Loading, Screen } from "../../src/components/ui"
import { FadeIn, PressScale } from "../../src/components/motion"
import { colors, formatPrice, radius } from "../../src/lib/theme"
import { formatFullDate, formatSlotTime } from "../../src/lib/time"

function MenuItemCard({ item, slug }: { item: MenuItem; slug: string }) {
  const { add } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const image = mediaUrl(item.image)

  function handleAdd() {
    add(item, slug)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 900)
  }

  return (
    <View style={styles.itemCard}>
      {image ? (
        <Image source={{ uri: image }} style={styles.itemImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.itemImage, styles.itemImageFallback]}>
          <Ionicons name="image-outline" size={26} color="rgba(36,30,25,0.2)" />
        </View>
      )}

      <View style={styles.itemBody}>
        <View style={styles.itemHead}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
        </View>
        {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}

        <PressScale
          onPress={handleAdd}
          scaleTo={0.95}
          style={styles.addButtonWrap}
          accessibilityLabel={`Add ${item.name}`}
        >
          <View style={[styles.addButton, justAdded && styles.addButtonAdded]}>
            <Ionicons
              name={justAdded ? "checkmark" : "add"}
              size={13}
              color={justAdded ? colors.moss500 : colors.ink800}
            />
            <Text style={[styles.addButtonText, justAdded && { color: colors.moss500 }]}>
              {justAdded ? "Added" : "Add"}
            </Text>
          </View>
        </PressScale>
      </View>
    </View>
  )
}

function GroupTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} scaleTo={0.95}>
      <View style={[styles.groupTab, active && styles.groupTabActive]}>
        <Text style={[styles.groupTabText, active && { color: colors.parchment50 }]}>{label}</Text>
      </View>
    </PressScale>
  )
}

export default function MenuScreen() {
  // `reservationId` is how the reservation path announces itself: arriving from a booking
  // pins the basket to that booking, so it is never mistaken for a delivery order.
  const { slug = "", reservationId } = useLocalSearchParams<{
    slug: string
    reservationId?: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { count, total, restaurantSlug, fulfilment, setReservationId } = useCart()

  useEffect(() => {
    if (reservationId) setReservationId(reservationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId])

  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurant = useMemo(
    () => (restaurants.data ?? []).find((r) => r.slug === slug),
    [restaurants.data, slug],
  )

  const reservations = useQuery({
    queryKey: ["reservations", "me"],
    queryFn: getMyReservations,
    enabled: Boolean(reservationId),
  })
  const linkedBooking = (reservations.data ?? []).find((r) => r.id === reservationId)

  const [group, setGroup] = useState<"food" | "bar">("food")
  const categories = useMemo(() => mamajanMenu.filter((c) => c.group === group), [group])
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "")
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0]

  function handleGroupChange(next: "food" | "bar") {
    setGroup(next)
    const first = mamajanMenu.find((c) => c.group === next)
    if (first) setActiveCategoryId(first.id)
  }

  // The cart belongs to one restaurant at a time, so the bar only counts up the basket when
  // it is actually for the kitchen on screen.
  const cartIsHere = count > 0 && restaurantSlug === slug

  if (restaurants.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    )
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topBarRow}>
          <PressScale onPress={() => router.replace("/")} scaleTo={0.97}>
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Ionicons name="restaurant-outline" size={13} color={colors.parchment50} />
              </View>
              <Text style={styles.brandText}>
                ITB <Text style={styles.brandAccent}>Reservation</Text>
              </Text>
            </View>
          </PressScale>
          <PressScale onPress={() => router.back()} scaleTo={0.96}>
            <View style={styles.backLink}>
              <Ionicons name="arrow-back" size={13} color={colors.ink600} />
              <Text style={styles.backLinkText} numberOfLines={1}>
                Back
              </Text>
            </View>
          </PressScale>
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.title}>Menu</Text>
            <Text style={styles.titleMeta} numberOfLines={1}>
              {restaurant?.name ?? slug}
            </Text>
          </View>
          <View style={styles.groupToggle}>
            <GroupTab label="Food" active={group === "food"} onPress={() => handleGroupChange("food")} />
            <GroupTab label="Bar & Drinks" active={group === "bar"} onPress={() => handleGroupChange("bar")} />
          </View>
        </View>

        {fulfilment === "reservation" && (
          <View style={styles.banner}>
            <Ionicons name="calendar-outline" size={13} color={colors.ember600} />
            <Text style={styles.bannerText}>
              {linkedBooking
                ? `Pre-ordering for your ${formatFullDate(linkedBooking.start_time)} · ${formatSlotTime(linkedBooking.start_time)} booking — the kitchen cooks it for that time.`
                : "This basket is going to your table booking, not to a courier."}
            </Text>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          style={{ marginTop: 14 }}
        >
          {categories.map((c) => {
            const active = c.id === activeCategory?.id
            return (
              <PressScale key={c.id} onPress={() => setActiveCategoryId(c.id)} scaleTo={0.95}>
                <View style={[styles.categoryChip, active ? styles.categoryChipActive : styles.categoryChipIdle]}>
                  <Text style={[styles.categoryText, active && { color: colors.parchment50 }]}>{c.name}</Text>
                </View>
              </PressScale>
            )
          })}
        </ScrollView>
      </View>

      <FlatList
        key={activeCategory?.id}
        data={activeCategory?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <FadeIn delay={Math.min(index, 8) * 40} offset={12} duration={400}>
            <MenuItemCard item={item} slug={slug} />
          </FadeIn>
        )}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
        // The menu runs to hundreds of photographed dishes — virtualise it rather than mounting
        // every card the way the web grid did.
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
      />

      <View style={[styles.cartBarWrap, { bottom: insets.bottom + 18 }]} pointerEvents="box-none">
        <PressScale onPress={() => router.push("/basket")} scaleTo={0.97}>
          <View style={styles.cartBar}>
            <Ionicons name="cart-outline" size={16} color={colors.parchment50} />
            <Text style={styles.cartBarText}>
              {cartIsHere ? `${count} item${count === 1 ? "" : "s"} · ${formatPrice(total)}` : "Your order"}
            </Text>
            <View style={styles.cartBarArrow}>
              <Ionicons name="arrow-forward" size={14} color={colors.parchment50} />
            </View>
          </View>
        </PressScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.parchment50,
  },
  topBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.parchment50,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    height: 28,
    width: 28,
    borderRadius: 14,
    backgroundColor: colors.ink950,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 17,
    color: colors.ink950,
  },
  brandAccent: {
    fontStyle: "italic",
    color: colors.ember600,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backLinkText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.ink600,
  },
  titleRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 30,
    color: colors.ink950,
  },
  titleMeta: {
    fontSize: 12,
    color: colors.ink600,
  },
  groupToggle: {
    flexDirection: "row",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 3,
  },
  groupTab: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  groupTabActive: {
    backgroundColor: colors.ink950,
  },
  groupTabText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.ink600,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(234,88,12,0.3)",
    backgroundColor: colors.tintEmber,
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.ink900 },
  categoryRow: {
    gap: 8,
    paddingRight: 20,
  },
  categoryChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryChipIdle: {
    borderColor: colors.line,
  },
  categoryChipActive: {
    borderColor: colors.ember500,
    backgroundColor: colors.ember500,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.ink700,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 14,
  },
  itemCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.parchment100,
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "rgba(36,30,25,0.04)",
  },
  itemImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: {
    padding: 18,
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  itemName: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink950,
  },
  itemPrice: {
    fontSize: 13,
    color: colors.ember600,
  },
  itemDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink600,
  },
  addButtonWrap: {
    alignSelf: "flex-start",
    marginTop: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonAdded: {
    borderColor: "rgba(77,124,82,0.4)",
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.ink800,
  },
  cartBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  cartBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.ink950,
    paddingLeft: 20,
    paddingRight: 10,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  cartBarText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.parchment50,
  },
  cartBarArrow: {
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
})
