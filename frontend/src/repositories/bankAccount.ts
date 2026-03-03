import { useQuery } from "@tanstack/react-query";
import type { UserAccount } from "../@types/types";
import api from "../services/api";

export const BANK_ACCOUNT = "bankAccount" 


export const getBankAccountByAccountId = async (accountId: string): Promise<UserAccount | null> => {
    const { data } = await api.get<UserAccount>(`/bankaccounts`, {
        params: {
            accountId
        }
    });
    return data;
};


export const getBankAccountByUser = async (userId)=>{
}

export const createBankAccount = async (account: UserAccount): Promise<UserAccount> => {
    const { data } = await api.put<UserAccount>(`/bankaccounts`, account);
    return data;
};

export const useGetUserAccounts = (userId:string)=>{
    const {data = []} = useQuery<UserAccount[]>({
        queryKey:[BANK_ACCOUNT, {userId}],
        queryFn:()=>api.get(`/user/${userId}/bankaccounts`).then(e=>e.data)
    })
    return data
}