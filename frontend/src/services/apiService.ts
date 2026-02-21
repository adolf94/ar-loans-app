import api from './api';
import type { User, Loan, Transaction } from '../@types/types';

// Users API
export const updateUser = async (id: string, user: Partial<User>): Promise<User> => {
    const { data } = await api.put<User>(`/users/${id}`, user);
    return data;
};

// Loans API
export const getLoans = async (): Promise<Loan[]> => {
    const { data } = await api.get<Loan[]>('/loans');
    return data;
};

export const createLoan = async (loan: Partial<Loan>): Promise<Loan> => {
    const { data } = await api.post<Loan>('/loans', loan);
    return data;
};

// Transactions API
export const getTransactions = async (): Promise<Transaction[]> => {
    const { data } = await api.get<Transaction[]>('/transactions');
    return data;
};

export const createTransaction = async (transaction: Partial<Transaction>): Promise<Transaction> => {
    const { data } = await api.post<Transaction>('/transactions', transaction);
    return data;
};
