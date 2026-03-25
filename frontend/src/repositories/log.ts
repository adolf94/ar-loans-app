import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';
import type { LogEntry } from '../@types/types';

export const useLogs = (count: number = 50) => {
    return useQuery<LogEntry[]>({
        queryKey: ['logs', count],
        queryFn: async () => {
            const { data } = await apiClient.get(`/Log?count=${count}`);
            return data;
        },
        refetchInterval: 5000,
    });
};

export const useLogsByChatId = (chatId: string, count: number = 50) => {
    return useQuery<LogEntry[]>({
        queryKey: ['logs', chatId, count],
        queryFn: async () => {
            const { data } = await apiClient.get(`/Log/chat/${chatId}?count=${count}`);
            return data;
        },
        enabled: !!chatId,
    });
};
