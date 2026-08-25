import { useMemo, useState } from "react"
import { FlatList, Image, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useQuery } from "@tanstack/react-query"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { mamajanMenu, type MenuItem } from "../../../src/lib/mamajanMenu"
import { getRestaurantContent } from "../../../src/lib/restaurantContent"
import { getRestaurants } from "../../../src/lib/api"
import { mediaUrl } from "../../../src/lib/config"
import { CartProvider, useCart } from "../../../src/hooks/useCart"
import { CartDrawer } from "../../../src/components/menu/CartDrawer"
import { alpha, colors, fonts, radius } from "../../../src/lib/theme"
import { FadeIn } from "../../../src/components/ui/FadeIn"
import { PressScale } from "../../../src/components/ui/Pressable"

function formatPrice(n: number): string {
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ₼`
}

function MenuItemCard({ item }: { item: MenuItem }) {
  const { add } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const image = mediaUrl(item.image)

  function handleAdd() {
    add(item)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 900)
  }

  return (
    <View style={styles.itemCard}>
      {image ? (
        <Image source={{ uri: image }} style={styles.itemImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.itemImage, styles.itemImageFallback]}>
          <Ionicons name="image-outline" size={26} color={alpha.ink(0.2)} />
        </View>
      )}

      <View style={styles.itemBody}>
        <View style={styles.itemHead}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
        </View>
        {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}

        <PressScale onPress={handleAdd} scaleTo={0.95} style={styles.addButtonWrap}>
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

function MenuInner() {
  const { slug = "" } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = getRestaurantContent(slug)
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurantId = restaurants.data?.find((r) => r.slug === slug)?.id ?? null

  const [group, setGroup] = useState<"food" | "bar">("food")
  const categories = useMemo(() => mamajanMenu.filter((c) => c.group === group), [group])
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "")
  const [cartOpen, setCartOpen] = useState(false)
  const { count, total } = useCart()

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0]

  function handleGroupChange(next: "food" | "bar") {
    setGroup(next)
    const first = mamajanMenu.find((c) => c.group === next)
    if (first) setActiveCategoryId(first.id)
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
          <Text style={styles.title}>Menu</Text>
          <View style={styles.groupToggle}>
            <GroupTab label="Food" active={group === "food"} onPress={() => handleGroupChange("food")} />
            <GroupTab label="Bar & Drinks" active={group === "bar"} onPress={() => handleGroupChange("bar")} />
          </View>
        </View>

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
            <MenuItemCard item={item} />
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
        <PressScale onPress={() => setCartOpen(true)} scaleTo={0.97}>
          <View style={styles.cartBar}>
            <Ionicons name="cart-outline" size={16} color={colors.parchment50} />
            <Text style={styles.cartBarText}>
              {count > 0 ? `${count} item${count === 1 ? "" : "s"} · ${formatPrice(total)}` : "Your order"}
            </Text>
            <View style={styles.cartBarArrow}>
              <Ionicons name="arrow-forward" size={14} color={colors.parchment50} />
            </View>
          </View>
        </PressScale>
      </View>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurantName={content.displayName}
        restaurantId={restaurantId}
      />
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

export default function RestaurantMenuScreen() {
  return (
    <CartProvider>
      <MenuInner />
    </CartProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.parchment50,
  },
  topBar: {
    borderBottomWidth: 1,
    borderBottomColor: alpha.ink(0.08),
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
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink950,
  },
  brandAccent: {
    fontFamily: fonts.displayItalic,
    color: colors.ember600,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backLinkText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.ink600,
  },
  titleRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.ink950,
  },
  groupToggle: {
    flexDirection: "row",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.ink(0.1),
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
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.ink600,
  },
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
    borderColor: alpha.ink(0.1),
  },
  categoryChipActive: {
    borderColor: colors.ember500,
    backgroundColor: colors.ember500,
  },
  categoryText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
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
    borderColor: alpha.ink(0.08),
    backgroundColor: colors.parchment100,
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: alpha.ink(0.04),
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
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink950,
  },
  itemPrice: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ember600,
  },
  itemDescription: {
    marginTop: 8,
    fontFamily: fonts.sans,
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
    borderColor: alpha.ink(0.12),
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonAdded: {
    borderColor: alpha.moss(0.4),
  },
  addButtonText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
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
    fontFamily: fonts.sansMedium,
    fontSize: 14,
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
