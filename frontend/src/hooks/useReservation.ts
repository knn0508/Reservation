import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  cancelReservation,
  createPreorder,
  createReservation,
  getMyReservations,
  type CreateReservationInput,
  type PreorderItem,
} from "../lib/api"

export function useMyReservations() {
  return useQuery({
    queryKey: ["reservations", "me"],
    queryFn: getMyReservations,
  })
}

export function useCreateReservation() {
  return useMutation({
    mutationFn: (input: CreateReservationInput) => createReservation(input),
  })
}

export function useCancelReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: (reservation) => {
      queryClient.setQueryData(["reservation", reservation.id], reservation)
      queryClient.invalidateQueries({ queryKey: ["reservations", "me"] })
    },
  })
}

export function useCreatePreorder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      reservationId,
      restaurantId,
      items,
    }: {
      reservationId: string
      restaurantId: number
      items: PreorderItem[]
    }) => createPreorder(reservationId, restaurantId, items),
    onSuccess: (reservation) => {
      queryClient.setQueryData(["reservation", reservation.id], reservation)
      queryClient.invalidateQueries({ queryKey: ["reservations", "me"] })
    },
  })
}
