import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import api from '../services/api';

export interface Entry {
    id: string;
    description: string;
    debitId: string;
    creditId: string;
    amount: number;
    date: string;
    addedBy?: string;
    loanId?: string;
    fileId?: string;
}

export const ENTRY = "entries"

export const getEntries = async (): Promise<Entry[]> => {
    const response = await apiClient.get<Entry[]>('/entries');
    return response.data;
};

export const useEntries = () => {
    return useQuery({
        queryKey: [ENTRY],
        queryFn: getEntries,
    });
};

export const useLoanEntries = (loanId: string) => {
    const { data: entries = [] } = useEntries();
    return entries.filter(e => e.loanId === loanId);
};


import { type TransactionResult, updateCacheOffline } from './cacheUpdates';

export const useCreateEntry = () => {
    let queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data: Entry) => api.post<TransactionResult>("/entries", data)
            .then(e => e.data),
        onSuccess: (data) => {
            updateCacheOffline(queryClient, data);
        }
    })

}

export const useDeleteEntry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            return await apiClient.delete<TransactionResult>(`/entries/${id}`)
                .then(e => e.data);
        },
        onSuccess: (data) => {
            updateCacheOffline(queryClient, data);
        },
    });
};
