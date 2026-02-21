import type { UserAccount } from "../@types/types";
import api from "../services/api";




export const getBankAccountByAccountId = async (accountId: string): Promise<UserAccount | null> => {
    const { data } = await api.get<UserAccount>(`/bankaccounts`, {
        params: {
            accountId
        }
    });
    return data;
};

export const createBankAccount = async (account: UserAccount): Promise<UserAccount> => {
    const { data } = await api.put<UserAccount>(`/bankaccounts`, account);
    return data;
};