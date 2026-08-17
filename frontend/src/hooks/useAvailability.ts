import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getAvailability, type AvailabilitySlot, type TableCategory } from "../lib/api"

function categoryForPartySize(partySize: number): TableCategory {
  return partySize <= 2 ? "2_seater" : "4_seater"
}

function wsUrl(restaurantId: number, day: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws"
  const host = window.location.hostname
  return `${proto}://${host}:8000/ws/availability/${restaurantId}/${day}`
}

export function availabilityKey(restaurantId: number, day: string, partySize: number) {
  return ["availability", restaurantId, day, partySize] as const
}

export function useAvailability(restaurantId: number, day: string, partySize: number) {
  const queryClient = useQueryClient()
  const socketRef = useRef<WebSocket | null>(null)
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
      socketRef.current = socket

      socket.onmessage = (event) => {
        const patch = JSON.parse(event.data) as { time: string; category: TableCategory; available_count: number }
        if (patch.category !== category) return
        queryClient.setQueryData<AvailabilitySlot[]>(availabilityKey(restaurantId, day, partySize), (current) => {
          if (!current) return current
          return current.map((slot) =>
            slot.time === patch.time ? { ...slot, available_count: patch.available_count } : slot,
          )
        })
      }

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
