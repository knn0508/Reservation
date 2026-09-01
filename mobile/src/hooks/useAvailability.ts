import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getAvailability, type AvailabilitySlot, type TableCategory } from "../lib/api"
import { WS_BASE } from "../lib/config"

function categoryForPartySize(partySize: number): TableCategory {
  return partySize <= 2 ? "2_seater" : "4_seater"
}

// React Native ships a WHATWG WebSocket, so the live-availability channel carries over
// unchanged; only the host has to be spelled out, since there is no page URL to derive it from.
function wsUrl(restaurantId: number, day: string): string {
  return `${WS_BASE}/ws/availability/${restaurantId}/${day}`
}

export function availabilityKey(restaurantId: number, day: string, partySize: number) {
  return ["availability", restaurantId, day, partySize] as const
}

export function useAvailability(restaurantId: number, day: string, partySize: number) {
  const queryClient = useQueryClient()
  const category = categoryForPartySize(partySize)

  const query = useQuery({
    queryKey: availabilityKey(restaurantId, day, partySize),
    queryFn: () => getAvailability(restaurantId, day, partySize),
    staleTime: 30_000,
  })

  useEffect(() => {
    let cancelled = false
    let socket: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (cancelled) return
      socket = new WebSocket(wsUrl(restaurantId, day))

      socket.onmessage = (event) => {
        const patch = JSON.parse(String(event.data)) as AvailabilitySlot & { category: TableCategory }
        if (patch.category !== category) return
        queryClient.setQueryData<AvailabilitySlot[]>(availabilityKey(restaurantId, day, partySize), (current) => {
          if (!current) return current
          return current.map((slot) =>
            slot.time === patch.time ? { ...slot, available_count: patch.available_count, tables: patch.tables } : slot,
          )
        })
      }

      // RN surfaces socket failures as onerror before onclose; swallow it so a backend that
      // isn't up yet doesn't spam a red box in dev.
      socket.onerror = () => {}

      socket.onclose = () => {
        if (!cancelled) retryTimer = setTimeout(connect, 2500)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      socket?.close()
    }
  }, [restaurantId, day, category, partySize, queryClient])

  return query
}
