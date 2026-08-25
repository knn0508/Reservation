import { useRef, useState } from "react"
import {
  Animated,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useQuery } from "@tanstack/react-query"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { getRestaurants } from "../../../src/lib/api"
import { getRestaurantContent } from "../../../src/lib/restaurantContent"
import { mediaUrl } from "../../../src/lib/config"
import { alpha, colors, fonts, radius } from "../../../src/lib/theme"
import { ImageLightbox } from "../../../src/components/restaurant/ImageLightbox"
import { Body, Display, LoadingScreen } from "../../../src/components/ui/Primitives"
import { FadeIn } from "../../../src/components/ui/FadeIn"
import { PressScale } from "../../../src/components/ui/Pressable"

export default function RestaurantProfileScreen() {
  const { slug = "" } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()

  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurant = restaurants.data?.find((r) => r.slug === slug)
  const content = getRestaurantContent(slug)

  const [lightboxIndex, setLightboxIndex] = useState(-1)

  // The web hero used framer-motion's useScroll/useTransform. The native equivalent is an
  // Animated.Value driven by the scroll offset, interpolated the same way.
  const scrollY = useRef(new Animated.Value(0)).current
  const heroHeight = Math.round(windowHeight * 0.75)

  const heroTranslate = scrollY.interpolate({
    inputRange: [0, heroHeight],
    outputRange: [0, heroHeight * 0.3],
    extrapolateLeft: "clamp",
  })
  const heroScale = scrollY.interpolate({
    inputRange: [-heroHeight, 0, heroHeight],
    outputRange: [1.3, 1, 1.15],
    extrapolateRight: "clamp",
  })
  const overlayOpacity = scrollY.interpolate({
    inputRange: [0, heroHeight],
    outputRange: [0.45, 0.85],
    extrapolate: "clamp",
  })

  if (restaurants.isLoading) return <LoadingScreen />

  if (!restaurant) {
    return (
      <View style={styles.notFound}>
        <Body>Restaurant not found.</Body>
        <PressScale onPress={() => router.replace("/")} scaleTo={0.96}>
          <Text style={styles.link}>Back to restaurants</Text>
        </PressScale>
      </View>
    )
  }

  const hasGallery = content.images.length > 0
  const heroImage = mediaUrl(content.images[0])
  const galleryIndex = Math.min(1, Math.max(content.images.length - 1, 0))
  const galleryImage = mediaUrl(content.images[galleryIndex])

  const openLink = (url: string) => {
    if (!url || url === "#") return
    void Linking.openURL(url)
  }

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {/* Hero */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateY: heroTranslate }, { scale: heroScale }] },
            ]}
          >
            {content.hasRealImages && heroImage ? (
              <Pressable onPress={() => setLightboxIndex(0)} accessibilityLabel="Open photo gallery">
                <Image
                  source={{ uri: heroImage }}
                  style={{ width: "100%", height: heroHeight }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              </Pressable>
            ) : (
              <View style={[styles.heroFallback, { height: heroHeight }]}>
                <Ionicons name="image-outline" size={40} color={alpha.parchment(0.3)} />
                <Text style={styles.heroFallbackText}>Hero photo placeholder</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.heroScrim, { opacity: overlayOpacity }]}
          />

          <View style={[styles.heroBody, { paddingBottom: 48 }]} pointerEvents="box-none">
            <FadeIn delay={100} offset={24} duration={800}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{content.cuisine || "Restaurant"}</Text>
              </View>
              <Text style={styles.heroTitle}>{content.displayName}</Text>
              <Text style={styles.heroTagline}>{content.tagline}</Text>
            </FadeIn>
          </View>

          <PressScale
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            scaleTo={0.9}
            style={[styles.backChip, { top: insets.top + 12 }]}
          >
            <View style={styles.backChipInner}>
              <Ionicons name="chevron-back" size={18} color={colors.parchment50} />
            </View>
          </PressScale>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Display size={34}>About</Display>
          <View style={{ marginTop: 20, gap: 16 }}>
            {content.about.map((p, i) => (
              <FadeIn key={i} delay={i * 60} offset={16} duration={600}>
                <Body style={styles.aboutParagraph}>{p}</Body>
              </FadeIn>
            ))}
          </View>

          <View style={styles.factList}>
            <Fact icon="location-outline" text={content.address} />
            <Fact icon="time-outline" text={content.hours} />
            <Fact icon="call-outline" text={content.phone} />
          </View>

          <View style={styles.socialRow}>
            <SocialButton icon="logo-instagram" label="Instagram" onPress={() => openLink(content.social.instagram)} />
            <SocialButton icon="logo-facebook" label="Facebook" onPress={() => openLink(content.social.facebook)} />
            <SocialButton icon="logo-whatsapp" label="WhatsApp" onPress={() => openLink(content.social.whatsapp)} />
          </View>

          <FadeIn offset={24} duration={650} style={{ marginTop: 28 }}>
            {hasGallery && galleryImage ? (
              <PressScale onPress={() => setLightboxIndex(galleryIndex)} scaleTo={0.98}>
                <View style={styles.galleryCard}>
                  <Image
                    source={{ uri: galleryImage }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                  <View style={styles.galleryCaption}>
                    <Text style={styles.galleryCaptionText}>View gallery</Text>
                  </View>
                </View>
              </PressScale>
            ) : (
              <View style={styles.galleryPlaceholder}>
                <Ionicons name="image-outline" size={32} color={alpha.ink(0.3)} />
                <Text style={styles.galleryPlaceholderText}>Gallery photo placeholder</Text>
              </View>
            )}
          </FadeIn>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          <View style={styles.menuCard}>
            <Display size={32}>Menu</Display>
            <Body style={{ marginTop: 14 }}>Open the menu and order before you come.</Body>
            <PressScale
              onPress={() => router.push(`/restaurants/${slug}/menu`)}
              scaleTo={0.98}
              style={{ marginTop: 22, alignSelf: "flex-start" }}
            >
              <View style={styles.darkCta}>
                <Text style={styles.darkCtaText}>View the menu</Text>
                <View style={styles.darkCtaArrow}>
                  <Ionicons name="arrow-forward" size={15} color={colors.parchment50} />
                </View>
              </View>
            </PressScale>
          </View>
        </View>

        {/* Reservation */}
        <View style={styles.section}>
          <FadeIn offset={20} duration={650}>
            <View style={styles.reserveCard}>
              <View style={styles.reserveBadge}>
                <Text style={styles.reserveBadgeText}>Reservation</Text>
              </View>
              <Text style={styles.reserveTitle}>Hold your table at {content.displayName}.</Text>
              <Text style={styles.reserveBody}>
                Pick a date and party size, we'll show real-time availability and confirm in under a minute.
              </Text>
              <PressScale
                onPress={() => router.push(`/restaurants/${slug}/book`)}
                scaleTo={0.98}
                style={{ marginTop: 26, alignSelf: "flex-start" }}
              >
                <View style={styles.lightCta}>
                  <Text style={styles.lightCtaText}>Reserve a table</Text>
                  <View style={styles.lightCtaArrow}>
                    <Ionicons name="arrow-forward" size={15} color={colors.ink950} />
                  </View>
                </View>
              </PressScale>
            </View>
          </FadeIn>
        </View>
      </Animated.ScrollView>

      {hasGallery && (
        <ImageLightbox
          images={content.images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(-1)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </View>
  )
}

function Fact({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={18} color={colors.ember600} style={{ marginTop: 1 }} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  )
}

function SocialButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <PressScale onPress={onPress} accessibilityLabel={label} scaleTo={0.92}>
      <View style={styles.socialButton}>
        <Ionicons name={icon} size={17} color={colors.ink700} />
      </View>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.parchment50,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: colors.parchment50,
    padding: 24,
  },
  link: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ember600,
    textDecorationLine: "underline",
  },
  hero: {
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: colors.ink900,
  },
  heroFallback: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.ink900,
  },
  heroFallbackText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: alpha.parchment(0.3),
  },
  heroScrim: {
    backgroundColor: colors.ink950,
  },
  heroBody: {
    paddingHorizontal: 20,
  },
  heroBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.parchment(0.25),
    backgroundColor: alpha.parchment(0.08),
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroBadgeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: alpha.parchment(0.9),
  },
  heroTitle: {
    marginTop: 18,
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 48,
    color: colors.parchment50,
  },
  heroTagline: {
    marginTop: 14,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: alpha.parchment(0.8),
  },
  backChip: {
    position: "absolute",
    left: 16,
  },
  backChipInner: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha.parchment(0.25),
    backgroundColor: "rgba(25,21,18,0.4)",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 56,
  },
  aboutParagraph: {
    fontSize: 15,
    lineHeight: 24,
  },
  factList: {
    marginTop: 32,
    gap: 14,
  },
  fact: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  factText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink600,
  },
  socialRow: {
    marginTop: 26,
    flexDirection: "row",
    gap: 12,
  },
  socialButton: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: alpha.ink(0.1),
  },
  galleryCard: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: alpha.ink(0.08),
    justifyContent: "flex-end",
    backgroundColor: colors.ink900,
  },
  galleryCaption: {
    backgroundColor: "rgba(25,21,18,0.55)",
    padding: 18,
  },
  galleryCaptionText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: alpha.parchment(0.85),
  },
  galleryPlaceholder: {
    width: "100%",
    aspectRatio: 4 / 5,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: alpha.ink(0.15),
    backgroundColor: alpha.ink(0.03),
  },
  galleryPlaceholderText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: alpha.ink(0.4),
  },
  menuSection: {
    borderTopWidth: 1,
    borderTopColor: alpha.ink(0.08),
    backgroundColor: alpha.ink(0.03),
    paddingHorizontal: 20,
    paddingVertical: 56,
  },
  menuCard: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: alpha.ink(0.08),
    backgroundColor: colors.parchment50,
    padding: 28,
  },
  darkCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.ink950,
    paddingLeft: 22,
    paddingRight: 10,
    paddingVertical: 10,
  },
  darkCtaText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.parchment50,
  },
  darkCtaArrow: {
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  reserveCard: {
    borderRadius: 32,
    backgroundColor: colors.ink950,
    padding: 32,
    overflow: "hidden",
  },
  reserveBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.parchment(0.2),
    backgroundColor: alpha.parchment(0.06),
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  reserveBadgeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: alpha.parchment(0.8),
  },
  reserveTitle: {
    marginTop: 18,
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    color: colors.parchment50,
  },
  reserveBody: {
    marginTop: 14,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: alpha.parchment(0.7),
  },
  lightCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.parchment50,
    paddingLeft: 22,
    paddingRight: 10,
    paddingVertical: 10,
  },
  lightCtaText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink950,
  },
  lightCtaArrow: {
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(25,21,18,0.1)",
  },
})
