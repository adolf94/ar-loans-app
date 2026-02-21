import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Payment } from "../@types/types"
import api from "../services/api"




export const useCreatePayment = ()=>{
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn:(data:Payment)=>api.post("payments", data),
        onSuccess:()=>queryClient.invalidateQueries({queryKey:['payments']})
    })
}