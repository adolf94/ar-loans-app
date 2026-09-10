import type { User } from '../@types/types';
import { getBankAccountByAccountId, getBankAccountByName } from '../repositories/bankAccount';
import {
    ingestionRecipientAccountName,
    ingestionRecipientAccountNumber,
    type IngestionRecord
} from '../repositories/finance';

/** Uppercased alphanumeric-only form of a name, for exact-match comparisons. */
export const normalizeName = (value: string | null | undefined): string =>
    (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Resolve the loans-app user id an ingestion record was paid to:
 * 1. recipient account number via bank-account lookup (handles masked numbers),
 * 2. recipient account name via bank-account lookup,
 * 3. exact (normalized) user-name match, only when unambiguous.
 * Returns '' when no client can be resolved.
 */
export const resolveIngestionClientId = async (
    record: IngestionRecord,
    users: User[]
): Promise<string> => {
    const acctNumber = ingestionRecipientAccountNumber(record);
    if (acctNumber) {
        const acct = await getBankAccountByAccountId(acctNumber).catch(() => null);
        if (acct?.userId) return acct.userId;
    }
    const acctName = ingestionRecipientAccountName(record);
    if (acctName) {
        const acct = await getBankAccountByName(acctName).catch(() => null);
        if (acct?.userId) return acct.userId;
        const norm = normalizeName(acctName);
        if (norm) {
            const matches = users.filter(u => normalizeName(u.name) === norm);
            if (matches.length === 1) return matches[0].id;
        }
    }
    return '';
};

/**
 * Resolve the loans-app asset account id (for destination/source fields)
 * matching the notification's receiving account, or '' when unresolvable.
 */
export const resolveIngestionDestinationAcct = async (record: IngestionRecord): Promise<string> => {
    const acctNumber = ingestionRecipientAccountNumber(record);
    if (acctNumber) {
        const acct = await getBankAccountByAccountId(acctNumber).catch(() => null);
        if (acct?.accountId) return acct.accountId;
    }
    const acctName = ingestionRecipientAccountName(record);
    if (acctName) {
        const acct = await getBankAccountByName(acctName).catch(() => null);
        if (acct?.accountId) return acct.accountId;
    }
    return '';
};
