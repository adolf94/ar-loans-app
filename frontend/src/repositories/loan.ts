import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import type { Loan, LoanStatus } from '../@types/types';
import api from '../services/api';

export const createLoan = async (loan: Loan): Promise<Loan> => {
    const response = await apiClient.post<Loan>('/loans', loan);
    return response.data;
};

export const getLoans = async (): Promise<Loan[]> => {
    const response = await apiClient.get<Loan[]>('/loans');
    return response.data;
};

export const useLoans = () => {
    return useQuery({
        queryKey: ['loans'],
        queryFn: getLoans,
    });
};

/**
 * Hook to fetch loans with optional status filter
 * @param status - Optional loan status to filter by ('Active', 'Paid', etc.)
 * @returns React Query result with filtered loans
 * 
 * @example
 * // Get all active loans
 * const { data: activeLoans } = useLoansFiltered('Active');
 * 
 * // Get all loans (same as useLoans)
 * const { data: allLoans } = useLoansFiltered();
 */
export const useLoansFiltered = (status?: LoanStatus) => {
    return useQuery({
        queryKey: status ? ['loans', 'status', status] : ['loans'],
        queryFn: async () => {
            const loans = await getLoans();
            return status ? loans.filter(loan => loan.status === status) : loans;
        },
    });
};

export const useGuaranteedLoans = (guid:string)=>{
    const queryClient = useQueryClient()
    return useQuery({
        queryKey:['loans', {guarantorId:guid}],
        queryFn: async () => {

            const loans = await queryClient.getQueryData<Loan[]>(["loans"])
            if(!!loans){
                return loans.filter(loan => loan.guarantorId === guid) 
            }
            return await api.get(`/guarantor/${guid}/loans`)
                .then(e=>e.data)
        },
    });
}

export const useUserLoans = (guid:string)=>{
    const queryClient = useQueryClient()
    const {data = []} = useQuery({
        queryKey:['loans', {clientId:guid}],
        queryFn: async () => {

            const loans = await queryClient.getQueryData<Loan[]>(["loans"])
            if(!!loans){
                return loans.filter(loan => loan.clientId === guid) 
            }
            return await api.get(`/user/${guid}/loans`)
                .then(e=>e.data)
        },
    });
    return data
}


export const useCreateLoan = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createLoan,
        onSuccess: () => {
            // Invalidate all loan queries (including filtered ones)
            queryClient.invalidateQueries({ queryKey: ['loans'] });
        },
    });
};
