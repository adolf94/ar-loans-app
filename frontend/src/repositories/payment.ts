import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Payment } from "../@types/types"
import api from "../services/api"
import { type TransactionResult, updateCacheOffline } from "./cacheUpdates"

export const useCreatePayment = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data: Payment) => api.post("payments", data).then(r => r.data as TransactionResult),
        onSuccess: (data) => {
            updateCacheOffline(queryClient, data);
        }
    })
}