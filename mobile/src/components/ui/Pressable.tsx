import { useRef, type ReactNode } from "react"
import { Animated, Easing, Pressable, type StyleProp, type ViewStyle } from "react-native"

/** Replaces framer-motion's `whileTap={{ scale }}`: a spring-ish press-in on every tappable
 *  surface, so the app keeps the tactile feel the web buttons had. */
export function PressScale({
  children,
  onPress,
  disabled,
  style,
  scaleTo = 0.96,
  accessibilityLabel,
  hitSlop,
}: {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  scaleTo?: number
  accessibilityLabel?: string
  hitSlop?: number
}) {
  const scale = useRef(new Animated.Value(1)).current

  const to = (value: number) =>
    Animated.timing(scale, {
      toValue: value,
      duration: 140,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start()

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !disabled && to(scaleTo)}
      onPressOut={() => to(1)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  )
}
