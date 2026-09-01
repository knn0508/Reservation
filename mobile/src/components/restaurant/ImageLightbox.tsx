import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { mediaUrl } from "../../lib/config"
import { alpha, colors } from "../../lib/theme"
import { FadeIn } from "../ui/FadeIn"
import { PressScale } from "../ui/Pressable"

interface ImageLightboxProps {
  images: string[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

/** Full-screen gallery. The web version bound Escape/arrow keys; on a phone the equivalents are
 *  the hardware back button (handled by Modal's onRequestClose) and the arrow buttons. */
export function ImageLightbox({ images, index, onClose, onIndexChange }: ImageLightboxProps) {
  const open = index >= 0
  const { height } = useWindowDimensions()

  if (!open) return null

  const step = (delta: number) => onIndexChange((index + delta + images.length) % images.length)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <PressScale onPress={onClose} accessibilityLabel="Close gallery" style={styles.close} scaleTo={0.9}>
          <View style={styles.roundButton}>
            <Ionicons name="close" size={18} color={colors.parchment50} />
          </View>
        </PressScale>

        {images.length > 1 && (
          <>
            <PressScale onPress={() => step(-1)} accessibilityLabel="Previous image" style={styles.prev} scaleTo={0.9}>
              <View style={styles.roundButton}>
                <Ionicons name="chevron-back" size={18} color={colors.parchment50} />
              </View>
            </PressScale>
            <PressScale onPress={() => step(1)} accessibilityLabel="Next image" style={styles.next} scaleTo={0.9}>
              <View style={styles.roundButton}>
                <Ionicons name="chevron-forward" size={18} color={colors.parchment50} />
              </View>
            </PressScale>
          </>
        )}

        {/* Stops a tap on the photo itself from dismissing the gallery. */}
        <Pressable onPress={() => {}} style={styles.stage}>
          <FadeIn key={index} offset={0} duration={320}>
            <Image
              source={{ uri: mediaUrl(images[index]) }}
              style={[styles.image, { maxHeight: height * 0.8 }]}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </FadeIn>
        </Pressable>

        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => onIndexChange(i)}
                accessibilityLabel={`Show image ${i + 1}`}
                hitSlop={8}
                style={[styles.dot, i === index ? styles.dotActive : styles.dotIdle]}
              />
            ))}
          </View>
        )}
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(25,21,18,0.94)",
  },
  stage: {
    width: "88%",
  },
  image: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 18,
  },
  roundButton: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: alpha.parchment(0.2),
  },
  close: {
    position: "absolute",
    right: 18,
    top: 48,
    zIndex: 2,
  },
  prev: {
    position: "absolute",
    left: 12,
    top: "50%",
    // RN has no translate(-50%); half the button's own height re-centres it.
    marginTop: -22,
    zIndex: 2,
  },
  next: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -22,
    zIndex: 2,
  },
  dots: {
    position: "absolute",
    bottom: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.parchment50,
  },
  dotIdle: {
    width: 6,
    backgroundColor: alpha.parchment(0.35),
  },
})
