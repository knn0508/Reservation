import { useEffect, useRef, useState } from "react"
import { deliveryTrackingUrl, getDeliveryTracking, type DeliveryTracking } from "../lib/api"

/**
 * Live courier position for one order.
 *
 * REST once, then the socket - never the socket alone. Bootstrapping live state over the
 * socket would leave the screen blank whenever the connection drops during load, and the
 * socket only ever carries *changes*.
 */
export interface TrackingState {
  tracking: DeliveryTracking | null
  /** True while the socket is open; false means the numbers on screen are the last known. */
  live: boolean
}

/** "1.2 km" reads better than "1200 m"; under a kilometre stay in metres. */
export function formatDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`
  return `${Math.round(metres / 10) * 10} m`
}

/**
 * A range, never a single number - a precise minute you miss reads worse than a range you
 * hit. Sub-minute differences are noise at delivery scale, so both ends round to a minute.
 */
export function formatEtaRange(lowSeconds: number, highSeconds: number): string {
  const low = Math.max(1, Math.round(lowSeconds / 60))
  const high = Math.max(low + 1, Math.round(highSeconds / 60))
  return `${low}–${high} min`
}

export function useDeliveryTracking(orderId: string, enabled: boolean): TrackingState {
  const [tracking, setTracking] = useState<DeliveryTracking | null>(null)
  const [live, setLive] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) {
      setTracking(null)
      setLive(false)
      return
    }

    // Guards every async continuation below: an order that finishes (or a screen that
    // unmounts) must not have a late response write state or reopen a socket.
    let cancelled = false
    let attempt = 0

    async function bootstrap() {
      try {
        const snapshot = await getDeliveryTracking(orderId)
        if (!cancelled) setTracking(snapshot)
      } catch {
        // A failed bootstrap is not fatal - the first ping over the socket fills it in.
      }
    }

    async function connect() {
      if (cancelled) return
      let url: string
      try {
        url = await deliveryTrackingUrl(orderId)
      } catch {
        return
      }
      if (cancelled) return

      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.onopen = () => {
        if (cancelled) return
        attempt = 0
        setLive(true)
      }

      socket.onmessage = (event) => {
        if (cancelled) return
        try {
          const message = JSON.parse(String(event.data)) as {
            event: string
            data: DeliveryTracking
          }
          if (message.event === "loc:update") setTracking(message.data)
        } catch {
          // A malformed frame is not worth tearing the connection down for.
        }
      }

      socket.onerror = () => setLive(false)

      socket.onclose = (event) => {
        setLive(false)
        if (cancelled) return
        // 4401/4404/4409 are the server's deliberate refusals - unauthorised, not yours, or
        // no longer trackable because the order was delivered or cancelled. Retrying those
        // would hammer the gateway for a room that will never open.
        if (event.code === 4401 || event.code === 4404 || event.code === 4409) return
        attempt += 1
        const backoff = Math.min(1000 * 2 ** (attempt - 1), 30000)
        retryRef.current = setTimeout(() => void connect(), backoff)
      }
    }

    void bootstrap()
    void connect()

    return () => {
      cancelled = true
      if (retryRef.current) clearTimeout(retryRef.current)
      const socket = socketRef.current
      socketRef.current = null
      if (socket) {
        // Drop the handler first: close() fires onclose, which would otherwise schedule a
        // reconnect for a screen that is already gone.
        socket.onclose = null
        socket.close()
      }
      setLive(false)
    }
  }, [orderId, enabled])

  return { tracking, live }
}
