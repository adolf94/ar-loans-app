import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';

export interface Account {
    id: string;
    name: string;
    section: string;
    balance: number;
}
export const ACCOUNT = "accounts"

export const getAccounts = async (): Promise<Account[]> => {
    const response = await apiClient.get<Account[]>('/accounts');
    return response.data;
};

export const createAccount = async (account: Partial<Account>): Promise<Account> => {
    const response = await apiClient.post<Account>('/accounts', account);
    return response.data;
};

export const useAccounts = () => {
    return useQuery({
        queryKey: [ACCOUNT],
        queryFn: getAccounts,
    });
};

import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useCreateAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ACCOUNT] });
        },
    });
};
