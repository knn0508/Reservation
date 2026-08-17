import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cancelReservation, createReservation, getMyReservations, type CreateReservationInput } from "../lib/api"

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
