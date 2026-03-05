import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import type { InterestRule } from '../@types/types';

const fetchRules = async (): Promise<InterestRule[]> => {
    const { data } = await apiClient.get('/InterestRules');
    return data;
};

export const useGetInterestRules = () => {
    return useQuery<InterestRule[], Error>({
        queryKey: ['interestRules'], 
        queryFn: fetchRules,
    });
};

const createRule = async (rule: Partial<InterestRule>): Promise<InterestRule> => {
    const { data } = await apiClient.post('/InterestRules', rule);
    return data;
};

export const useCreateInterestRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interestRules'] });
        },
    });
};

const updateRule = async (rule: Partial<InterestRule>): Promise<InterestRule> => {
    const { data } = await apiClient.put(`/InterestRules/${rule.id}`, rule);
    return data;
};

export const useUpdateInterestRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interestRules'] });
        },
    });
};

const deleteRule = async (id: string): Promise<void> => {
    await apiClient.delete(`/InterestRules/${id}`);
};

export const useDeleteInterestRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interestRules'] });
        },
    });
};
