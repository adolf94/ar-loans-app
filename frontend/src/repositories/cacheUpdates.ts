import type { QueryClient } from '@tanstack/react-query';
import type { Loan, Payment } from '../@types/types';
import { type Entry, ENTRY } from './entry';
import { type Account, ACCOUNT } from './account';
import { LOAN } from './loan';

export interface TransactionResult {
    loan?: Loan;
    payment?: Payment;
    entry?: Entry;
    entries?: Entry[];
    accounts?: Account[];
    deletedEntryIds?: string[];
}

export const updateCacheOffline = (
    queryClient: QueryClient,
    result: TransactionResult
) => {
    // 1. Update Loan
    if (result.loan) {
        const updateLoanFn = (oldData: Loan[] | undefined) => {
            if (!oldData) return undefined; // Should not happen if we check existence first
            const index = oldData.findIndex(l => l.id === result.loan!.id);
            if (index !== -1) {
                const newData = [...oldData];
                newData[index] = result.loan!;
                return newData;
            } else {
                return [...oldData, result.loan!];
            }
        };

        if (queryClient.getQueryData([LOAN])) {
            queryClient.setQueryData([LOAN], updateLoanFn);
        }
        if (queryClient.getQueryData([LOAN, { clientId: result.loan.clientId }])) {
            queryClient.setQueryData([LOAN, { clientId: result.loan.clientId }], updateLoanFn);
        }
        if (result.loan.guarantorId && queryClient.getQueryData([LOAN, { guarantorId: result.loan.guarantorId }])) {
            queryClient.setQueryData([LOAN, { guarantorId: result.loan.guarantorId }], updateLoanFn);
        }
    }

    // 2. Update Entries
    const entriesToUpdate: Entry[] = [];
    if (result.entries) entriesToUpdate.push(...result.entries);
    if (result.entry) entriesToUpdate.push(result.entry);

    if ((entriesToUpdate.length > 0 || result.deletedEntryIds?.length) && queryClient.getQueryData([ENTRY])) {
        queryClient.setQueryData([ENTRY], (oldData: Entry[] | undefined) => {
            if (!oldData) return undefined;
            let newData = [...oldData];

            // Handle deletions
            if (result.deletedEntryIds?.length) {
                newData = newData.filter(e => !result.deletedEntryIds!.includes(e.id));
            }

            // Handle updates/additions
            entriesToUpdate.forEach(e => {
                const idx = newData.findIndex(old => old.id === e.id);
                if (idx !== -1) newData[idx] = e;
                else newData.unshift(e); // Add new entry to the top
            });
            return newData;
        });
    }

    // 3. Update Accounts
    if (result.accounts && result.accounts.length > 0 && queryClient.getQueryData([ACCOUNT])) {
        queryClient.setQueryData([ACCOUNT], (oldData: Account[] | undefined) => {
            if (!oldData) return undefined;
            const newData = [...oldData];
            result.accounts!.forEach(a => {
                const idx = newData.findIndex(old => old.id === a.id);
                if (idx !== -1) newData[idx] = a;
                else newData.push(a);
            });
            return newData;
        });
    }
};
