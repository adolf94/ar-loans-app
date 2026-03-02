import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import api from '../services/api';
import { ACCOUNT } from './account';

export interface Entry {
    id: string;
    description: string;
    debitId: string;
    creditId: string;
    amount: number;
    date: string;
    addedBy?: string;
    loanId?: string;
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


export const useCreateEntry = () => {
    let queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data: Entry) => api.post<Entry>("/entries", data)
            .then(e => e.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ENTRY] })

            queryClient.invalidateQueries({ queryKey: [ACCOUNT] });

        }
    })

}

export const useDeleteEntry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/entries/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ENTRY] });
            queryClient.invalidateQueries({ queryKey: ['loans'] });
            queryClient.invalidateQueries({ queryKey: [ACCOUNT] });
        },
    });
};
