import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getFleetCouriers, type FleetCourier } from "../lib/api"
import { getToken } from "../lib/auth-storage"

/**
 * The live fleet: a REST roster, kept moving by a socket.
 *
 * REST first and socket second, never socket alone - a connection that drops during load
 * would otherwise leave the dispatcher looking at an empty map.
 *
 * The build guide keeps positions in a ref and moves markers imperatively, because 30
 * couriers pinging every 3 s is ten React renders a second. That aggregation already happens
 * on the server here: the gateway coalesces pings into one `loc:batch` per second, so plain
 * state costs one render per second, which is what the ref was buying. If the batch interval
 * ever drops below ~250 ms, move this back to a ref.
 */

export interface LivePosition {
  lat: number
  lng: number
  heading: number | null
  speed_mps: number | null
  /** Epoch seconds of the fix, from the courier device. */
  t: number
  order_id: string | null
}

interface FleetBatchItem {
  c: number
  lat: number
  lng: number
  h: number | null
  s: number | null
  t: number
  order_id: string | null
}

function wsUrl(restaurantId: number, token: string): string {
  // The API is on its own port, not the Vite dev origin - same as useAvailability. The port
  // is overridable so the dashboard can be pointed at a second backend during development
  // without editing source; it defaults to the 8000 every other caller assumes.
  const proto = window.location.protocol === "https:" ? "wss" : "ws"
  const host = window.location.hostname
  const port = import.meta.env.VITE_API_WS_PORT ?? "8000"
  return `${proto}://${host}:${port}/ws/fleet/${restaurantId}?token=${encodeURIComponent(token)}`
}

export function useCourierFleet(restaurantId: number | null) {
  const queryClient = useQueryClient()
  const [live, setLive] = useState<Record<number, LivePosition>>({})
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  const roster = useQuery({
    queryKey: ["admin", "fleet", "couriers"],
    queryFn: getFleetCouriers,
    // A slow poll as a floor under the socket: it repairs shift changes and new hires even
    // if the socket is healthy, and keeps the map populated if it is not.
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (restaurantId === null) return
    const token = getToken()
    if (!token) return

    let cancelled = false
    let socket: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let attempt = 0

    function connect() {
      if (cancelled || restaurantId === null) return
      socket = new WebSocket(wsUrl(restaurantId, token as string))
      socketRef.current = socket

      socket.onopen = () => {
        if (cancelled) return
        attempt = 0
        setConnected(true)
      }

      socket.onmessage = (event) => {
        if (cancelled) return
        const message = JSON.parse(event.data) as { event: string; data: FleetBatchItem[] }
        if (message.event !== "loc:batch") return
        setLive((current) => {
          const next = { ...current }
          for (const item of message.data) {
            next[item.c] = {
              lat: item.lat,
              lng: item.lng,
              heading: item.h,
              speed_mps: item.s,
              t: item.t,
              order_id: item.order_id,
            }
          }
          return next
        })
        // A courier who just started moving may not be on the roster yet (a shift that began
        // after the last poll), so nudge it rather than waiting out the 30 s interval.
        queryClient.invalidateQueries({ queryKey: ["admin", "fleet", "summary"] })
      }

      socket.onerror = () => setConnected(false)

      socket.onclose = (event) => {
        setConnected(false)
        if (cancelled) return
        // 4401/4403 are deliberate refusals - not authenticated, or not an admin of this
        // restaurant. Retrying those just hammers the gateway.
        if (event.code === 4401 || event.code === 4403) return
        attempt += 1
        retry = setTimeout(connect, Math.min(1000 * 2 ** (attempt - 1), 30_000))
      }
    }

    connect()

    return () => {
      cancelled = true
      if (retry) clearTimeout(retry)
      const open = socketRef.current
      socketRef.current = null
      if (open) {
        open.onclose = null
        open.close()
      }
      setConnected(false)
    }
  }, [restaurantId, queryClient])

  /** Roster merged with live positions; the socket wins where it has something newer. */
  const couriers: FleetCourier[] = (roster.data ?? []).map((courier) => {
    const position = live[courier.id]
    if (!position) return courier
    return {
      ...courier,
      lat: position.lat,
      lng: position.lng,
      heading: position.heading,
      speed_mps: position.speed_mps,
      age_s: Math.max(0, Math.round(Date.now() / 1000 - position.t)),
    }
  })

  return { couriers, connected, isLoading: roster.isLoading, refetch: roster.refetch }
}
