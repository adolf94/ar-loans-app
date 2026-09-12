import React, { useMemo, useState } from 'react';
import { Link2, Unlink, RefreshCw, PlayCircle, Wallet } from 'lucide-react';
import {
    useLinkedBalances, useFinanceAccounts, useFinanceAccountGroups, useAccountLinks,
    useUpsertAccountLink, useDeleteAccountLink,
    useIngestions, useProcessIngestion, useFinanceSyncItems, useRetryFinanceSyncItems,
    isFinanceEnabled,
    ingestionAmount, ingestionDate, ingestionNote, ingestionDisplayText
} from '../../repositories/finance';
import type { LinkedBalanceRow, IngestionRecord, FinanceAccount } from '../../repositories/finance';
import { useLoans } from '../../repositories/loan';
import { useUsers } from '../../repositories/user';
import { useIsMobile } from '../../theme';
import { Button, IconButton, Stamp, Dialog, Spinner, Divider, Label, Panel } from '../ui';

const SECTIONS = ['Assets', 'Liabilities', 'Income', 'Expenses'];

const money = (n: number | null | undefined) =>
    n == null ? '—' : `P ${n.toLocaleString()}`;

const stampTone = (s: string): 'good' | 'bad' | 'silver' | 'amber' | 'safelight' =>
    s === 'Completed' ? 'good'
        : s === 'Failed' ? 'bad'
            : s === 'Cancelled' ? 'silver'
                : s === 'Processing' ? 'safelight' : 'amber';

const LinkRow: React.FC<{ row: LinkedBalanceRow }> = ({ row }) => {
    const { data: financeAccounts = [] } = useFinanceAccounts();
    const { data: groups = [] } = useFinanceAccountGroups();
    const { data: links = [] } = useAccountLinks();
    const upsert = useUpsertAccountLink();
    const remove = useDeleteAccountLink();

    const existingLink = links.find(l => l.loanAccountId === row.loanAccountId);
    const [selected, setSelected] = useState<string>(row.financeAccountId ?? '');

    const currentLink = useMemo(
        () => financeAccounts.find(f => f.id === selected),
        [financeAccounts, selected]);

    // Group accounts by their finance account group, sorted by group name,
    // with members sorted by account name. Accounts without a group land in "Ungrouped".
    const groupedAccounts = useMemo(() => {
        const byGroup = new Map<string, FinanceAccount[]>();
        financeAccounts.forEach(f => {
            const groupName = groups.find(g => g.id === f.accountGroupId)?.name ?? 'Ungrouped';
            if (!byGroup.has(groupName)) byGroup.set(groupName, []);
            byGroup.get(groupName)!.push(f);
        });
        return [...byGroup.entries()]
            .map(([group, accounts]) => [group, [...accounts].sort((a, b) => a.name.localeCompare(b.name))] as const)
            .sort((a, b) => a[0].localeCompare(b[0]));
    }, [financeAccounts, groups]);

    const dirty = selected !== (row.financeAccountId ?? '');

    return (
        <tr className="hover:bg-tray/50 transition-colors">
            <td className="px-4 py-3">
                <p className="text-sm text-paper font-semibold">{row.loanAccountName}</p>
                <p className="text-xs text-silverdim">{row.section}</p>
            </td>
            <td className="px-4 py-3 text-right font-mono text-paper tnum">{money(row.loanBalance)}</td>
            <td className="px-4 py-3">
                <select
                    className="w-full bg-bay border border-line rounded-md px-3 py-2 text-sm text-paper focus:border-amberdeep"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                >
                    <option value="">Not linked</option>
                    {groupedAccounts.map(([group, accounts]) => (
                        <optgroup key={group} label={group}>
                            {accounts.map(f => (
                                <option key={f.id} value={f.id}>{f.name} ({f.accountType})</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </td>
            <td className="px-4 py-3 text-right font-mono text-silver tnum">{money(currentLink?.currentBalance)}</td>
            <td className="px-4 py-3">
                <div className="flex justify-end items-center gap-2">
                    <Button
                        size="sm"
                        variant={row.isLinked ? 'outline' : 'amber'}
                        startIcon={<Link2 size={14} strokeWidth={1.7} />}
                        disabled={!dirty || !selected || upsert.isPending}
                        onClick={() => upsert.mutate({ loanAccountId: row.loanAccountId, financeAccountId: selected })}>
                        {row.isLinked ? 'Update' : 'Link'}
                    </Button>
                    {existingLink && (
                        <IconButton
                            label="Unlink account"
                            disabled={remove.isPending}
                            onClick={() => {
                                if (window.confirm('Unlink this account? Existing mirrored transactions are kept in finance.'))
                                    remove.mutate(existingLink.id);
                            }}>
                            <Unlink size={16} strokeWidth={1.7} />
                        </IconButton>
                    )}
                </div>
            </td>
        </tr>
    );
};

const IngestionProcessDialog: React.FC<{
    open: boolean;
    ingestion: IngestionRecord | null;
    onClose: () => void;
}> = ({ open, ingestion, onClose }) => {
    const { data: loans = [] } = useLoans();
    const { data: users = [] } = useUsers();
    const { data: balances = [] } = useLinkedBalances();
    const process = useProcessIngestion();

    const activeLoans = loans.filter(l => l.status === 'Active');
    const linkedAssetAccounts = balances.filter(b => b.isLinked && b.section === 'Assets');

    const [loanId, setLoanId] = useState('');
    const [destinationAccountId, setDestination] = useState('');
    const [amount, setAmount] = useState(() => {
        const amt = ingestion ? ingestionAmount(ingestion) : null;
        return amt != null ? String(amt) : '';
    });
    const [date, setDate] = useState(() =>
        ingestion ? (ingestionDate(ingestion) ?? new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10));
    const [note, setNote] = useState(() => (ingestion ? (ingestionNote(ingestion) ?? '') : ''));

    const userName = (id: string) => users.find(u => u.id === id)?.name ?? 'Unknown';

    const amountNum = parseFloat(amount);
    const canSubmit = !!loanId && !!destinationAccountId && !Number.isNaN(amountNum) && amountNum > 0 && !process.isPending;

    const errorMessage = () => {
        const err = process.error as { response?: { data?: unknown }; message?: string } | null;
        const data = err?.response?.data;
        if (typeof data === 'string') return data;
        if (data && typeof data === 'object' && 'message' in data) return String((data as { message: unknown }).message);
        return err?.message ?? 'Failed to process ingestion.';
    };

    const onSubmit = () => {
        if (!ingestion || !canSubmit) return;
        process.mutate(
            {
                ingestionId: ingestion.id,
                request: { loanId, destinationAccountId, amount: amountNum, date: date || null, note: note || null }
            },
            { onSuccess: () => onClose() });
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Process Notification into Loan Payment"
            width="max-w-xl"
            actions={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={onSubmit} disabled={!canSubmit}
                        startIcon={process.isPending ? <Spinner size={16} /> : <PlayCircle size={18} strokeWidth={1.7} />}>
                        {process.isPending ? 'Processing...' : 'Create Payment'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                {ingestion && (
                    <div className="border border-linestrong rounded-tray bg-tray/50 px-4 py-3 text-sm">
                        <p className="font-semibold text-paper">{ingestionDisplayText(ingestion) ?? 'Ingestion event'}</p>
                        <p className="text-xs text-silverdim font-mono mt-0.5">ID: {ingestion.id}</p>
                    </div>
                )}
                <div>
                    <Label>Loan</Label>
                    <select
                        className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:border-amberdeep"
                        value={loanId}
                        onChange={(e) => setLoanId(e.target.value)}
                    >
                        {activeLoans.map(l => (
                            <option key={l.id} value={l.id}>
                                {userName(l.clientId)} — {l.alternateId} (bal {money(l.balance)})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <Label>Deposit To (linked account)</Label>
                    <select
                        className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:border-amberdeep disabled:opacity-50"
                        value={destinationAccountId}
                        onChange={(e) => setDestination(e.target.value)}
                        disabled={linkedAssetAccounts.length === 0}
                    >
                        {linkedAssetAccounts.map(b => (
                            <option key={b.loanAccountId} value={b.loanAccountId}>
                                {b.loanAccountName} ({money(b.loanBalance)})
                            </option>
                        ))}
                    </select>
                    {linkedAssetAccounts.length === 0 && (
                        <p className="mt-1.5 text-xs text-bad">
                            Link at least one Asset account (and Loan Receivables) above first.
                        </p>
                    )}
                </div>
                <div>
                    <Label>Amount</Label>
                    <input
                        type="number"
                        className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper tnum focus:border-amberdeep"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </div>
                <div>
                    <Label>Date</Label>
                    <input
                        type="date"
                        className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:border-amberdeep"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>
                <div>
                    <Label>Note / Reference</Label>
                    <textarea
                        rows={2}
                        className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:border-amberdeep"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>
                {process.isError && (
                    <div className="border border-bad/60 rounded-tray bg-bad/10 px-4 py-3 text-sm text-bad" role="alert">
                        {errorMessage()}
                    </div>
                )}
            </div>
        </Dialog>
    );
};

const IngestionsSection: React.FC = () => {
    const [status, setStatus] = useState('Pending');
    const { data: ingestions = [], isLoading, refetch, isFetching } = useIngestions(status);
    const [selected, setSelected] = useState<IngestionRecord | null>(null);
    const [open, setOpen] = useState(false);

    return (
        <div>
            <div className="flex justify-between items-center flex-wrap gap-3 mb-3">
                <h2 className="text-paper font-semibold text-lg tracking-tight">Notifications (Ingestions)</h2>
                <div className="flex items-center gap-2">
                    <select
                        className="bg-bay border border-line rounded-md px-3 py-2 text-sm text-paper focus:border-amberdeep"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Dismissed">Dismissed</option>
                    </select>
                    <IconButton label="Refresh ingestions" onClick={() => refetch()} disabled={isFetching}>
                        <RefreshCw size={16} strokeWidth={1.7} className={isFetching ? 'animate-spin' : ''} />
                    </IconButton>
                </div>
            </div>

            <div className="overflow-x-auto">
                <Panel pad={false} className="min-w-[560px]">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim border-b border-linestrong">
                                <th className="px-4 py-3 font-medium">Reference / Description</th>
                                <th className="px-4 py-3 font-medium text-right">Amount</th>
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line/70">
                            {isLoading && (
                                <tr><td colSpan={4} className="px-4 py-4"><Spinner size={20} /></td></tr>
                            )}
                            {!isLoading && ingestions.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-4 text-center text-sm text-silverdim">No {status.toLowerCase()} ingestions</td></tr>
                            )}
                            {ingestions.map((ing) => {
                                const amt = ingestionAmount(ing);
                                return (
                                    <tr key={ing.id} className="hover:bg-tray/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-paper">{ingestionDisplayText(ing) ?? '(no description)'}</p>
                                            <p className="text-xs text-silverdim font-mono">{ing.id}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-paper tnum">{amt != null ? money(amt) : '—'}</td>
                                        <td className="px-4 py-3 font-mono text-silverdim">{ingestionDate(ing) ?? '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            {status === 'Pending' && (
                                                <Button size="sm" startIcon={<Wallet size={14} strokeWidth={1.7} />}
                                                    onClick={() => { setSelected(ing); setOpen(true); }}>
                                                    Process
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Panel>
            </div>

            {open && (
                <IngestionProcessDialog
                    key={selected?.id ?? 'none'}
                    open={open}
                    ingestion={selected}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
};

const SyncStatusSection: React.FC = () => {
    const { data: items = [], refetch, isFetching } = useFinanceSyncItems();
    const retry = useRetryFinanceSyncItems();

    return (
        <div>
            <div className="flex justify-between items-center flex-wrap gap-3 mb-3">
                <h2 className="text-paper font-semibold text-lg tracking-tight">Sync Queue</h2>
                <div className="flex gap-2">
                    <IconButton label="Run sync retry" onClick={() => retry.mutate()} disabled={retry.isPending}>
                        <PlayCircle size={16} strokeWidth={1.7} />
                    </IconButton>
                    <IconButton label="Refresh sync queue" onClick={() => refetch()} disabled={isFetching}>
                        <RefreshCw size={16} strokeWidth={1.7} className={isFetching ? 'animate-spin' : ''} />
                    </IconButton>
                </div>
            </div>
            <div className="overflow-x-auto">
                <Panel pad={false} className="min-w-[640px]">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim border-b border-linestrong">
                                <th className="px-4 py-3 font-medium">Kind</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium text-right">Attempts</th>
                                <th className="px-4 py-3 font-medium">Finance Tx</th>
                                <th className="px-4 py-3 font-medium">Detail</th>
                                <th className="px-4 py-3 font-medium">Updated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line/70">
                            {items.length === 0 && (
                                <tr><td colSpan={6} className="px-4 py-4 text-center text-sm text-silverdim">No sync activity yet</td></tr>
                            )}
                            {items.map(it => (
                                <tr key={it.id} className="hover:bg-tray/50 transition-colors">
                                    <td className="px-4 py-3 text-paper">{it.kind}</td>
                                    <td className="px-4 py-3"><Stamp tone={stampTone(it.status)}>{it.status}</Stamp></td>
                                    <td className="px-4 py-3 text-right font-mono text-silver tnum">{it.attempts}</td>
                                    <td className="px-4 py-3 font-mono text-silverdim">{it.financeTransactionId ?? '—'}</td>
                                    <td className={`px-4 py-3 text-xs ${it.lastError ? 'text-bad' : 'text-silverdim'}`}>
                                        {it.lastError ?? ''}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-silverdim">{new Date(it.updatedAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>
            </div>
        </div>
    );
};

const FinanceSettingsTab: React.FC = () => {
    const { data: balances = [], isLoading } = useLinkedBalances();
    const isMobile = useIsMobile();
    const financeEnabled = isFinanceEnabled();

    const bySection = (section: string) => balances.filter(a => a.section === section);

    return (
        <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h2 className="text-paper font-semibold text-xl tracking-tight">Finance Integration</h2>
                <Stamp tone={financeEnabled ? 'good' : 'silver'} dashed={!financeEnabled}>
                    {financeEnabled ? 'Enabled' : 'Disabled'}
                </Stamp>
            </div>
            {!financeEnabled && (
                <div className="border border-linestrong rounded-tray bg-tray/50 px-4 py-3 text-sm text-silver mb-4 mt-3">
                    The integration is currently disabled, so nothing is mirrored to finance and
                    notifications can&apos;t be processed yet. You can still configure account links
                    now; flip <code className="font-mono text-amber">enableFinanceIntegration</code> on in <code className="font-mono text-amber">config.js</code> (and
                    enable it in the backend) to activate it.
                </div>
            )}
            <p className="text-sm text-silverdim mb-5 max-w-2xl">
                Map loan-app ledger accounts to finance-app accounts. Only entries whose debit and credit
                accounts are both linked are mirrored to finance.
            </p>

            {SECTIONS.map(section => {
                const rows = bySection(section);
                if (rows.length === 0) return null;
                return (
                    <div key={section} className="mb-6">
                        <p className="text-paper font-semibold mb-2">{section}</p>
                        <div className="overflow-x-auto">
                            <Panel pad={false} className="min-w-[560px]">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim border-b border-linestrong">
                                            <th className="px-4 py-3 font-medium">Loan Account</th>
                                            <th className="px-4 py-3 font-medium text-right">Loan Balance</th>
                                            {!isMobile && <th className="px-4 py-3 font-medium">Finance Account</th>}
                                            {!isMobile && <th className="px-4 py-3 font-medium text-right">Finance Balance</th>}
                                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line/70">
                                        {rows.map(r => (
                                            <LinkRow key={`${r.loanAccountId}:${r.financeAccountId ?? ''}`} row={r} />
                                        ))}
                                    </tbody>
                                </table>
                            </Panel>
                        </div>
                    </div>
                );
            })}

            {isLoading && <Spinner size={24} />}

            {financeEnabled && (
                <>
                    <Divider className="my-6" />
                    <IngestionsSection />
                    <Divider className="my-6" />
                    <SyncStatusSection />
                </>
            )}
        </div>
    );
};

export default FinanceSettingsTab;
