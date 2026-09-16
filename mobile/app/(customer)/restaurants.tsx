import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getRestaurants, type Restaurant } from "../../src/lib/api"
import { useCart } from "../../src/hooks/useCart"
import { Card, EmptyState, Eyebrow, Loading, Screen, Subtitle, Title } from "../../src/components/ui"
import { colors } from "../../src/lib/theme"

export default function RestaurantsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { count, restaurantSlug } = useCart()

  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })

  function renderItem({ item }: { item: Restaurant }) {
    const hasCart = count > 0 && restaurantSlug === item.slug
    return (
      <Card style={styles.card}>
        <View style={styles.cardBody}>
          <View style={styles.cardText}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {hasCart ? `${count} item${count === 1 ? "" : "s"} in your basket` : "Baku"}
            </Text>
          </View>
        </View>
        {/* Two doors on purpose. Ordering from the menu is an online delivery order a
            courier will carry; booking a table starts the reservation path, where the
            pre-order is cooked for your booking time instead. */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push(`/menu/${item.slug}`)}
            style={({ pressed }) => [styles.action, pressed && styles.rowPressed]}
          >
            <Feather name="truck" size={15} color={colors.ink800} />
            <Text style={styles.actionText}>Order delivery</Text>
          </Pressable>
          <View style={styles.actionDivider} />
          <Pressable
            onPress={() => router.push(`/book/${item.slug}`)}
            style={({ pressed }) => [styles.action, pressed && styles.rowPressed]}
          >
            <Feather name="calendar" size={15} color={colors.ink800} />
            <Text style={styles.actionText}>Book a table</Text>
          </Pressable>
        </View>
      </Card>
    )
  }

  return (
    <Screen>
      <FlatList
        data={restaurants.data ?? []}
        keyExtractor={(r) => String(r.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 16 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Eyebrow>Online çatdırılma</Eyebrow>
            <Title>Order in</Title>
            <Subtitle>
              Order delivery and a courier brings it to your door — or book a table and
              pre-order, and the kitchen has it ready when you sit down.
            </Subtitle>
          </View>
        }
        ListEmptyComponent={
          restaurants.isLoading ? (
            <Loading />
          ) : (
            <EmptyState
              title="No restaurants yet"
              body="Nothing is open for delivery on this server right now."
            />
          )
        }
        refreshing={restaurants.isFetching && !restaurants.isLoading}
        onRefresh={() => void restaurants.refetch()}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  header: { marginBottom: 12 },
  rowPressed: { opacity: 0.6 },
  card: { padding: 0 },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  actionDivider: { width: 1, backgroundColor: colors.line },
  actionText: { fontSize: 13, fontWeight: "600", color: colors.ink800 },
  cardText: { flex: 1, gap: 4 },
  name: { fontSize: 19, color: colors.ink950 },
  meta: { fontSize: 12, color: colors.ink600 },
})
