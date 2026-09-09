import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';

export const FINANCE_ACCOUNTS = 'financeAccounts';
export const FINANCE_ACCOUNT_GROUPS = 'financeAccountGroups';
export const ACCOUNT_LINKS = 'accountLinks';
export const LINKED_BALANCES = 'linkedBalances';
export const FINANCE_INGESTIONS = 'financeIngestions';
export const FINANCE_SYNC_ITEMS = 'financeSyncItems';

/** Master on/off switch for the finance integration, driven by public/config.js. */
export const isFinanceEnabled = (): boolean =>
    window.webConfig?.enableFinanceIntegration === true;

export interface FinanceAccount {
    id: string;
    userId: string;
    accountGroupId?: string | null;
    name: string;
    description?: string | null;
    tags: string[];
    startingBalance: number;
    currentBalance: number;
    accountType: string;
}

export interface FinanceAccountGroup {
    id: string;
    userId: string;
    name: string;
    accountType: string;
}

export interface AccountLink {
    id: string;
    loanAccountId: string;
    financeAccountId: string;
    financeUserId: string;
    createdAt: string;
}

export interface LinkedBalanceRow {
    loanAccountId: string;
    loanAccountName: string;
    section: string;
    loanBalance: number;
    financeAccountId?: string | null;
    financeAccountName?: string | null;
    financeBalance?: number | null;
    isLinked: boolean;
}

/**
 * Ingestion records come from the external Notification Ingester and their exact
 * shape is not fully contracted, so all fields beyond id/status are best-effort.
 */
export interface IngestionRecord {
    id: string;
    status?: string;
    amount?: number | string | null;
    date?: string | null;
    createdAt?: string | null;
    description?: string | null;
    note?: string | null;
    reference?: string | null;
    referenceNumber?: string | null;
    sourceType?: string | null;
    channel?: string | null;
    senderName?: string | null;
    [key: string]: unknown;
}

export interface ProcessIngestionRequest {
    loanId: string;
    destinationAccountId: string;
    amount: number;
    date?: string | null;
    note?: string | null;
}

export interface ProcessIngestionResult {
    payment: unknown;
    loan: unknown;
    clientName?: string | null;
    ingestionId: string;
    message?: string;
}

export interface FinanceSyncItem {
    id: string;
    kind: string;
    status: string;
    entryId: string;
    financeTransactionId?: string | null;
    attempts: number;
    lastError?: string | null;
    createdAt: string;
    updatedAt: string;
}

// ---- Finance accounts (link picker) ----
const fetchFinanceAccounts = async (): Promise<FinanceAccount[]> => {
    const { data } = await apiClient.get<FinanceAccount[]>('/finance/accounts');
    return data;
};

export const useFinanceAccounts = () => useQuery({
    queryKey: [FINANCE_ACCOUNTS],
    queryFn: fetchFinanceAccounts,
    // Always available: the linking settings must be configurable even while
    // the integration is disabled.
});

// ---- Account groups (grouping for the link picker) ----
const fetchFinanceAccountGroups = async (): Promise<FinanceAccountGroup[]> => {
    const { data } = await apiClient.get<FinanceAccountGroup[]>('/finance/account-groups');
    return data;
};

export const useFinanceAccountGroups = () => useQuery({
    queryKey: [FINANCE_ACCOUNT_GROUPS],
    queryFn: fetchFinanceAccountGroups,
});

// ---- Account links ----
const fetchAccountLinks = async (): Promise<AccountLink[]> => {
    const { data } = await apiClient.get<AccountLink[]>('/finance/account-links');
    return data;
};

export const useAccountLinks = () => useQuery({
    queryKey: [ACCOUNT_LINKS],
    queryFn: fetchAccountLinks,
    // Always available: links can be configured while the integration is off.
});

const upsertAccountLink = async (payload: { loanAccountId: string; financeAccountId: string }): Promise<AccountLink> => {
    const { data } = await apiClient.post<AccountLink>('/finance/account-links', payload);
    return data;
};

export const useUpsertAccountLink = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: upsertAccountLink,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ACCOUNT_LINKS] });
            queryClient.invalidateQueries({ queryKey: [LINKED_BALANCES] });
        },
    });
};

const deleteAccountLink = async (id: string): Promise<void> => {
    await apiClient.delete(`/finance/account-links/${id}`);
};

export const useDeleteAccountLink = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteAccountLink,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ACCOUNT_LINKS] });
            queryClient.invalidateQueries({ queryKey: [LINKED_BALANCES] });
        },
    });
};

// ---- Linked dual balances ----
const fetchLinkedBalances = async (): Promise<LinkedBalanceRow[]> => {
    const { data } = await apiClient.get<LinkedBalanceRow[]>('/finance/linked-balances');
    return data;
};

export const useLinkedBalances = (enabled = true) => useQuery({
    queryKey: [LINKED_BALANCES],
    queryFn: fetchLinkedBalances,
    staleTime: 60_000,
    // Settings tab needs this for setup even when disabled; the balance-sheet
    // overlay passes isFinanceEnabled().
    enabled,
});

// ---- Ingestions (proxied, user-scoped) ----
const fetchIngestions = async (status: string): Promise<IngestionRecord[]> => {
    const { data } = await apiClient.get<IngestionRecord[]>('/finance/ingestions', {
        params: { status, top: 50 },
    });
    return Array.isArray(data) ? data : [];
};

export const useIngestions = (status = 'Pending', enabled = true) => useQuery({
    queryKey: [FINANCE_INGESTIONS, status],
    queryFn: () => fetchIngestions(status),
    enabled: enabled && isFinanceEnabled(),
});

const fetchIngestion = async (id: string): Promise<IngestionRecord> => {
    const { data } = await apiClient.get<IngestionRecord>(`/finance/ingestions/${id}`);
    return data;
};

export const useIngestion = (id: string | null | undefined, enabled = true) => useQuery({
    queryKey: [FINANCE_INGESTIONS, 'detail', id],
    queryFn: () => fetchIngestion(id!),
    enabled: enabled && !!id && isFinanceEnabled(),
});

const processIngestion = async ({ ingestionId, request }:
    { ingestionId: string; request: ProcessIngestionRequest }): Promise<ProcessIngestionResult> => {
    const { data } = await apiClient.post<ProcessIngestionResult>(
        `/finance/ingestions/${ingestionId}/process`, request);
    return data;
};

export const useProcessIngestion = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: processIngestion,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [FINANCE_INGESTIONS] });
            queryClient.invalidateQueries({ queryKey: [FINANCE_SYNC_ITEMS] });
        },
    });
};

// ---- Sync queue visibility ----
const fetchSyncItems = async (status?: string): Promise<FinanceSyncItem[]> => {
    const { data } = await apiClient.get<FinanceSyncItem[]>('/finance/sync-items', {
        params: status ? { status } : undefined,
    });
    return data;
};

export const useFinanceSyncItems = (status?: string, enabled = true) => useQuery({
    queryKey: [FINANCE_SYNC_ITEMS, status ?? 'all'],
    queryFn: () => fetchSyncItems(status),
    enabled: enabled && isFinanceEnabled(),
});

export interface FinanceSyncRetryResult {
    id: string;
    kind: string;
    status: string;
    attempts: number;
    financeTransactionId?: string | null;
    lastError?: string | null;
}

const retrySyncItems = async (): Promise<FinanceSyncRetryResult[]> => {
    const { data } = await apiClient.post<FinanceSyncRetryResult[]>('/finance/sync/retry');
    return data;
};

export const useRetryFinanceSyncItems = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: retrySyncItems,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [FINANCE_SYNC_ITEMS] });
        },
    });
};

// ---- Helpers for auto-populating the process dialog from an ingestion ----
// Record shape is best-effort: flat fields, plus `ai_parsed` (AI-extracted fields)
// and `raw_payload` (original notification) fallbacks.
const parsedSection = (ing: IngestionRecord): Record<string, unknown> => {
    const ai = ing.ai_parsed;
    return (ai && typeof ai === 'object' ? ai : {}) as Record<string, unknown>;
};

const rawSection = (ing: IngestionRecord): Record<string, unknown> => {
    const raw = ing.raw_payload;
    return (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
};

const toAmount = (value: unknown): number | null => {
    if (typeof value === 'number' && !Number.isNaN(value)) return Math.abs(value);
    if (typeof value === 'string') {
        const parsed = parseFloat(value.replace(/[^0-9.-]+/g, ''));
        if (!Number.isNaN(parsed)) return Math.abs(parsed);
    }
    return null;
};

const toDate = (value: unknown): string | null => {
    if (typeof value !== 'string' || !value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

const toText = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value : (typeof value === 'number' ? String(value) : null);

export const ingestionAmount = (ing: IngestionRecord): number | null => {
    const ai = parsedSection(ing);
    const raw = rawSection(ing);
    return toAmount(ing.amount) ?? toAmount(ai.amount) ?? toAmount(raw.amount);
};

export const ingestionDate = (ing: IngestionRecord): string | null => {
    const ai = parsedSection(ing);
    const raw = rawSection(ing);
    return toDate(ing.date) ?? toDate(ai.date) ?? toDate(raw.date)
        ?? toDate(ing.createdAt) ?? toDate(ai.created_at) ?? toDate(raw.created_at);
};

export const ingestionNote = (ing: IngestionRecord): string | null => {
    const ai = parsedSection(ing);
    const raw = rawSection(ing);
    return toText(ing.description) ?? toText(ing.note)
        ?? toText(ai.notes) ?? toText(ai.summary)
        ?? toText(ing.referenceNumber) ?? toText(ai.reference_number)
        ?? toText(ing.reference) ?? toText(raw.notif_id);
};

/** Text shown when DISPLAYING an ingestion: `raw_msg` first, then the note fallbacks. */
export const ingestionDisplayText = (ing: IngestionRecord): string | null => {
    const raw = rawSection(ing);
    return toText(ing.raw_msg) ?? toText(raw.raw_msg) ?? ingestionNote(ing);
};

/** `ai_parsed.recipient_account_number` (masked/partial numbers included), if any. */
export const ingestionRecipientAccountNumber = (ing: IngestionRecord): string | null => {
    const ai = parsedSection(ing);
    return toText(ai.recipient_account_number);
};

/** `ai_parsed.recipient_account_name`, if any. */
export const ingestionRecipientAccountName = (ing: IngestionRecord): string | null => {
    const ai = parsedSection(ing);
    return toText(ai.recipient_account_name);
};

/** Reference usable as a loan `alternateId`: `raw_payload.notif_id` -> `ai_parsed.reference_number`. */
export const ingestionLoanReference = (ing: IngestionRecord): string | null => {
    const ai = parsedSection(ing);
    const raw = rawSection(ing);
    return toText(raw.notif_id) ?? toText(ai.reference_number);
};
