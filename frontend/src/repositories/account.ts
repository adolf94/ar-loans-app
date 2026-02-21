import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';

export interface Account {
    id: string;
    name: string;
    section: string;
    balance: number;
}

export const getAccounts = async (): Promise<Account[]> => {
    const response = await apiClient.get<Account[]>('/accounts');
    return response.data;
};

export const useAccounts = () => {
    return useQuery({
        queryKey: ['accounts'],
        queryFn: getAccounts,
    });
};
