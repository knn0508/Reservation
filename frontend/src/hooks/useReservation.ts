import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cancelReservation, createReservation, getReservation, type CreateReservationInput } from "../lib/api"

export function useReservationLookup(id: string | null) {
  return useQuery({
    queryKey: ["reservation", id],
    queryFn: () => getReservation(id as string),
    enabled: Boolean(id),
    retry: false,
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
    },
  })
}
