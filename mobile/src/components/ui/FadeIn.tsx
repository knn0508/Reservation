import { useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, type ViewStyle, type StyleProp } from "react-native"

/** The entrance the web app got from framer-motion's `initial/animate` — a short rise and
 *  fade, driven by RN's built-in Animated so no native animation module is needed. */
export function FadeIn({
  children,
  delay = 0,
  offset = 16,
  duration = 450,
  style,
}: {
  children: ReactNode
  delay?: number
  offset?: number
  duration?: number
  style?: StyleProp<ViewStyle>
}) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      // The 0.32/0.72/0/1 curve the web design used everywhere.
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [progress, delay, duration])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
