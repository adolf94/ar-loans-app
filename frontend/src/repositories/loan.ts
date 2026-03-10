import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import type { Loan, LoanStatus } from '../@types/types';
import api from '../services/api';
import { ACCOUNT } from './account';
import { ENTRY } from './entry';

export const LOAN = "loan"

export const getLoans = async (): Promise<Loan[]> => {
    const response = await apiClient.get<Loan[]>('/loans');
    return response.data;
};

export const useLoans = () => {
    return useQuery({
        queryKey: [LOAN],
        queryFn: getLoans,
    });
};

export const updateLoanInCache = (loan: Loan) => {
    const queryClient = useQueryClient()

    const updateFn = (oldData: Loan[] | undefined) => {
        if (!oldData) return undefined;
        return oldData.map(l => l.id === loan.id ? loan : l);
    };

    if (queryClient.getQueryData([LOAN])) {
        queryClient.setQueryData([LOAN], updateFn);
    }

    if (queryClient.getQueryData([LOAN, { clientId: loan.clientId }])) {
        queryClient.setQueryData([LOAN, { clientId: loan.clientId }], updateFn);
    }

    if (queryClient.getQueryData([LOAN, { guarantorId: loan.guarantorId }])) {
        queryClient.setQueryData([LOAN, { guarantorId: loan.guarantorId }], updateFn);
    }
}

export const useLoansFiltered = (status?: LoanStatus) => {
    return useQuery({
        queryKey: status ? [LOAN, 'status', status] : [LOAN],
        queryFn: async () => {
            const loans = await getLoans();
            return status ? loans.filter(loan => loan.status === status) : loans;
        },
    });
};

export const useGuaranteedLoans = (guid: string) => {
    const queryClient = useQueryClient()
    return useQuery({
        queryKey: [LOAN, { guarantorId: guid }],
        queryFn: async () => {
            const loans = queryClient.getQueryData<Loan[]>([LOAN])
            if (loans) {
                return loans.filter(loan => loan.guarantorId === guid)
            }
            return await api.get(`/guarantor/${guid}/loans`).then(e => e.data)
        },
    });
}

export const useUserLoans = (guid: string) => {
    const queryClient = useQueryClient()
    const { data = [] } = useQuery({
        queryKey: [LOAN, { clientId: guid }],
        queryFn: async () => {
            const loans = queryClient.getQueryData<Loan[]>([LOAN])
            if (loans) {
                return loans.filter(loan => loan.clientId === guid)
            }
            return await api.get(`/user/${guid}/loans`).then(e => e.data)
        },
    });
    return data
}

import { type TransactionResult, updateCacheOffline } from './cacheUpdates';

export const useCreateLoan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (loan: Loan) => apiClient.post<TransactionResult>('/loans', loan).then(r => r.data),
        onSuccess: (data) => {
            updateCacheOffline(queryClient, data);
        },
    });
};

export const useDeleteLoan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/loans/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [LOAN] });
            queryClient.invalidateQueries({ queryKey: [ENTRY] });
            queryClient.invalidateQueries({ queryKey: [ACCOUNT] });
        },
    });
};
