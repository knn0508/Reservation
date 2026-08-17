import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getAvailability, type AvailabilitySlot } from "../lib/api"

function wsUrl(day: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws"
  const host = window.location.hostname
  return `${proto}://${host}:8000/ws/availability/${day}`
}

export function availabilityKey(day: string) {
  return ["availability", day] as const
}

export function useAvailability(day: string) {
  const queryClient = useQueryClient()
  const socketRef = useRef<WebSocket | null>(null)

  const query = useQuery({
    queryKey: availabilityKey(day),
    queryFn: () => getAvailability(day),
    staleTime: 30_000,
  })

  useEffect(() => {
    let cancelled = false
    let socket: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (cancelled) return
      socket = new WebSocket(wsUrl(day))
      socketRef.current = socket

      socket.onmessage = (event) => {
        const patch = JSON.parse(event.data) as AvailabilitySlot
        queryClient.setQueryData<AvailabilitySlot[]>(availabilityKey(day), (current) => {
          if (!current) return current
          return current.map((slot) => (slot.time === patch.time ? { ...slot, ...patch } : slot))
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
  }, [day, queryClient])

  return query
}
