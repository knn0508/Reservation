import { useState } from "react"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { usePathname, useRouter } from "expo-router"
import { useAuth } from "../../hooks/useAuth"
import { alpha, colors, fonts, radius } from "../../lib/theme"
import { FadeIn } from "../ui/FadeIn"
import { PressScale } from "../ui/Pressable"

/** The floating pill navigation from the web app. On a phone the links live behind the
 *  hamburger, exactly as they did below the `md:` breakpoint on the web. */

interface NavTarget {
  href: string
  label: string
}

const CUSTOMER_NAV: NavTarget[] = [
  { href: "/", label: "Restaurants" },
  { href: "/my-reservations", label: "My Reservation" },
]

const ADMIN_NAV: NavTarget[] = [{ href: "/admin", label: "Floor" }]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  const nav = user?.role === "admin" ? ADMIN_NAV : CUSTOMER_NAV

  function go(href: string) {
    setOpen(false)
    router.push(href as never)
  }

  function handleLogout() {
    logout()
    setOpen(false)
    router.replace("/")
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={styles.bar}>
        <PressScale onPress={() => router.push("/")} scaleTo={0.97}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Ionicons name="restaurant-outline" size={13} color={colors.parchment50} />
            </View>
            <Text style={styles.brandText}>
              ITB <Text style={styles.brandTextAccent}>Reservation</Text>
            </Text>
          </View>
        </PressScale>

        <PressScale onPress={() => setOpen((v) => !v)} accessibilityLabel="Toggle menu" hitSlop={10}>
          <View style={styles.menuButton}>
            <Ionicons name={open ? "close" : "menu"} size={20} color={colors.ink900} />
          </View>
        </PressScale>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => setOpen(false)}>
          <View style={styles.sheetInner}>
            {nav.map((item, i) => {
              const active = pathname === item.href
              return (
                <FadeIn key={item.href} delay={80 + i * 50} offset={32}>
                  <Pressable onPress={() => go(item.href)}>
                    <Text style={[styles.sheetLink, active && { color: colors.ember600 }]}>{item.label}</Text>
                  </Pressable>
                </FadeIn>
              )
            })}

            <FadeIn delay={300} offset={32} style={styles.sheetActions}>
              {user ? (
                <>
                  <Text style={styles.sheetUser}>Signed in as {user.full_name.split(" ")[0]}</Text>
                  <PressScale onPress={handleLogout} scaleTo={0.97}>
                    <View style={styles.solidPill}>
                      <Text style={styles.solidPillText}>Log out</Text>
                    </View>
                  </PressScale>
                </>
              ) : (
                <View style={styles.sheetAuthRow}>
                  <PressScale onPress={() => go("/login")} scaleTo={0.97}>
                    <View style={styles.outlinePill}>
                      <Text style={styles.outlinePillText}>Log in</Text>
                    </View>
                  </PressScale>
                  <PressScale onPress={() => go("/signup")} scaleTo={0.97}>
                    <View style={styles.solidPill}>
                      <Text style={styles.solidPillText}>Sign up</Text>
                    </View>
                  </PressScale>
                </View>
              )}
            </FadeIn>

            {!user && (
              <FadeIn delay={360} offset={20}>
                <Pressable onPress={() => go("/admin/login")}>
                  <Text style={styles.sheetStaffLink}>Staff access</Text>
                </Pressable>
              </FadeIn>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.parchment50,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.ink(0.1),
    backgroundColor: colors.parchment50,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 10,
    // Stands in for the web's layered `shadow-[0_12px_32px_-16px]`.
    shadowColor: colors.ink950,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
  brandTextAccent: {
    fontFamily: fonts.displayItalic,
    color: colors.ember600,
  },
  menuButton: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    flex: 1,
    backgroundColor: "rgba(251,248,243,0.97)",
  },
  sheetInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
  },
  sheetLink: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.ink950,
  },
  sheetActions: {
    marginTop: 10,
    alignItems: "center",
    gap: 12,
  },
  sheetUser: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink600,
  },
  sheetAuthRow: {
    flexDirection: "row",
    gap: 12,
  },
  solidPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.ink950,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  solidPillText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.parchment50,
  },
  outlinePill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.ink(0.15),
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  outlinePillText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink900,
  },
  sheetStaffLink: {
    fontFamily: fonts.sans,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: alpha.ink(0.4),
  },
})
