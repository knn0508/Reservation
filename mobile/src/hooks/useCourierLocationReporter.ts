import { useEffect, useRef } from "react"
import * as Location from "expo-location"
import { sendCourierLocation } from "../lib/api"

/**
 * Reports the courier's position while they are on shift.
 *
 * Adaptive sampling, per the build guide: the interval follows what the courier is doing,
 * which cuts ping volume roughly 70% with no visible difference to the customer, because
 * the customer's marker is interpolated between pings anyway.
 *
 * Foreground only. Background reporting needs `expo-task-manager` plus
 * ACCESS_BACKGROUND_LOCATION / UIBackgroundModes, which is also why the guide wants the
 * courier app shipped as its own binary - those permissions complicate store review and
 * must not touch the customer app.
 */
export type CourierPhase = "idle" | "to_pickup" | "on_route"

/** Interval per phase. Heading to a pickup is less urgent than carrying food to a door. */
const INTERVAL_MS: Record<CourierPhase, number> = {
  on_route: 3000,
  to_pickup: 5000,
  idle: 15000,
}

/** Below this the courier is standing still and the extra pings say nothing. */
const MOVING_MPS = 0.5

interface ReporterOptions {
  enabled: boolean
  orderId: string | null
  phase: CourierPhase
}

export function useCourierLocationReporter({ enabled, orderId, phase }: ReporterOptions): void {
  // Read inside the callback rather than captured, so a phase change does not need to tear
  // down and re-establish the GPS subscription.
  const orderRef = useRef(orderId)
  const phaseRef = useRef(phase)
  orderRef.current = orderId
  phaseRef.current = phase

  const lastSentRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let subscription: Location.LocationSubscription | null = null

    async function start() {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted" || cancelled) return

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          // The floor across all phases; the per-phase throttle below does the rest. Asking
          // the OS for the slowest interval would make a phase change take 15 s to speed up.
          timeInterval: INTERVAL_MS.on_route,
          distanceInterval: 5,
        },
        (position) => {
          if (cancelled) return
          const { latitude, longitude, heading, speed, accuracy } = position.coords

          const now = Date.now()
          const speedMps = speed != null && speed >= 0 ? speed : null
          const stationary = speedMps != null && speedMps < MOVING_MPS
          // A stopped courier still reports, just at the idle rate - going silent entirely
          // would let the customer's screen decide the signal was lost.
          const interval = stationary ? INTERVAL_MS.idle : INTERVAL_MS[phaseRef.current]
          if (now - lastSentRef.current < interval) return
          lastSentRef.current = now

          void sendCourierLocation({
            lat: latitude,
            lng: longitude,
            heading: heading != null && heading >= 0 ? Math.round(heading) : null,
            speed_mps: speedMps,
            accuracy_m: accuracy ?? null,
            order_id: orderRef.current,
          }).catch(() => {
            // Pings are fire-and-forget. The server drops low-accuracy fixes and rate-limits
            // floods by design, and a failed ping is superseded by the next one seconds later.
          })
        },
      )
    }

    void start()

    return () => {
      cancelled = true
      subscription?.remove()
    }
  }, [enabled])
}
