import React, { useMemo, useState } from 'react';
import {
    Box, Typography, Button, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, IconButton, Chip, Alert,
    FormControl, InputLabel, Select, MenuItem, ListSubheader, Stack, Divider, CircularProgress
} from '@mui/material';
import { Link2, Unlink, RefreshCw, PlayCircle, Wallet } from 'lucide-react';
import {
    useLinkedBalances, useFinanceAccounts, useFinanceAccountGroups, useAccountLinks,
    useUpsertAccountLink, useDeleteAccountLink,
    useIngestions, useProcessIngestion, useFinanceSyncItems,
    isFinanceEnabled,
    ingestionAmount, ingestionDate, ingestionNote, ingestionDisplayText
} from '../../repositories/finance';
import type { LinkedBalanceRow, IngestionRecord, FinanceAccount } from '../../repositories/finance';
import { useLoans } from '../../repositories/loan';
import { useUsers } from '../../repositories/user';
import { useIsMobile } from '../../theme';

const SECTIONS = ['Assets', 'Liabilities', 'Income', 'Expenses'];

const money = (n: number | null | undefined) =>
    n == null ? '—' : `P ${n.toLocaleString()}`;

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
        <TableRow>
            <TableCell>
                <Typography fontWeight={600}>{row.loanAccountName}</Typography>
                <Typography variant="caption" color="text.secondary">{row.section}</Typography>
            </TableCell>
            <TableCell align="right">{money(row.loanBalance)}</TableCell>
            <TableCell>
                <FormControl size="small" fullWidth>
                    <Select
                        value={selected}
                        displayEmpty
                        onChange={(e) => setSelected(e.target.value)}
                        renderValue={(v) => v
                            ? (financeAccounts.find(f => f.id === v)?.name ?? '(missing account)')
                            : <em style={{ opacity: 0.6 }}>Not linked</em>}
                    >
                        <MenuItem value="">
                            <em>Not linked</em>
                        </MenuItem>
                        {groupedAccounts.map(([group, accounts]) => (
                            <React.Fragment key={group}>
                                <ListSubheader sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>
                                    {group}
                                </ListSubheader>
                                {accounts.map(f => (
                                    <MenuItem key={f.id} value={f.id}>
                                        <Box component="span" sx={{ flexGrow: 1 }}>{f.name}</Box>
                                        <Box component="span" sx={{ opacity: 0.6, ml: 1 }}>{f.accountType}</Box>
                                    </MenuItem>
                                ))}
                            </React.Fragment>
                        ))}
                    </Select>
                </FormControl>
            </TableCell>
            <TableCell align="right">{money(currentLink?.currentBalance)}</TableCell>
            <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                    <Button
                        size="small"
                        variant={row.isLinked ? 'outlined' : 'contained'}
                        startIcon={<Link2 size={14} />}
                        disabled={!dirty || !selected || upsert.isPending}
                        onClick={() => upsert.mutate({ loanAccountId: row.loanAccountId, financeAccountId: selected })}>
                        {row.isLinked ? 'Update' : 'Link'}
                    </Button>
                    {existingLink && (
                        <IconButton
                            size="small" color="error" disabled={remove.isPending}
                            onClick={() => {
                                if (window.confirm('Unlink this account? Existing mirrored transactions are kept in finance.'))
                                    remove.mutate(existingLink.id);
                            }}>
                            <Unlink size={16} />
                        </IconButton>
                    )}
                </Stack>
            </TableCell>
        </TableRow>
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
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Process Notification into Loan Payment</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {ingestion && (
                        <Alert severity="info" variant="outlined">
                            <Typography variant="body2" fontWeight={600}>{ingestionDisplayText(ingestion) ?? 'Ingestion event'}</Typography>
                            <Typography variant="caption" color="text.secondary">ID: {ingestion.id}</Typography>
                        </Alert>
                    )}
                    <FormControl fullWidth>
                        <InputLabel>Loan</InputLabel>
                        <Select value={loanId} label="Loan" onChange={(e) => setLoanId(e.target.value)}>
                            {activeLoans.map(l => (
                                <MenuItem key={l.id} value={l.id}>
                                    {userName(l.clientId)} — {l.alternateId} (bal {money(l.balance)})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth disabled={linkedAssetAccounts.length === 0}>
                        <InputLabel>Deposit To (linked account)</InputLabel>
                        <Select value={destinationAccountId} label="Deposit To (linked account)"
                            onChange={(e) => setDestination(e.target.value)}>
                            {linkedAssetAccounts.map(b => (
                                <MenuItem key={b.loanAccountId} value={b.loanAccountId}>
                                    {b.loanAccountName} ({money(b.loanBalance)})
                                </MenuItem>
                            ))}
                        </Select>
                        {linkedAssetAccounts.length === 0 && (
                            <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                                Link at least one Asset account (and Loan Receivables) above first.
                            </Typography>
                        )}
                    </FormControl>
                    <TextField label="Amount" type="number" value={amount}
                        onChange={(e) => setAmount(e.target.value)} fullWidth />
                    <TextField label="Date" type="date" value={date}
                        onChange={(e) => setDate(e.target.value)}
                        InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField label="Note / Reference" value={note}
                        onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} />
                    {process.isError && <Alert severity="error">{errorMessage()}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={onSubmit} disabled={!canSubmit}
                    startIcon={process.isPending ? <CircularProgress size={16} /> : <PlayCircle size={18} />}>
                    {process.isPending ? 'Processing...' : 'Create Payment'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const IngestionsSection: React.FC = () => {
    const [status, setStatus] = useState('Pending');
    const { data: ingestions = [], isLoading, refetch, isFetching } = useIngestions(status);
    const [selected, setSelected] = useState<IngestionRecord | null>(null);
    const [open, setOpen] = useState(false);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>Notifications (Ingestions)</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    <FormControl size="small">
                        <Select value={status} onChange={(e) => setStatus(e.target.value)} size="small">
                            <MenuItem value="Pending">Pending</MenuItem>
                            <MenuItem value="Confirmed">Confirmed</MenuItem>
                            <MenuItem value="Dismissed">Dismissed</MenuItem>
                        </Select>
                    </FormControl>
                    <IconButton size="small" onClick={() => refetch()} disabled={isFetching}>
                        <RefreshCw size={16} />
                    </IconButton>
                </Stack>
            </Box>

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Reference / Description</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading && (
                            <TableRow><TableCell colSpan={4}><CircularProgress size={20} /></TableCell></TableRow>
                        )}
                        {!isLoading && ingestions.length === 0 && (
                            <TableRow><TableCell colSpan={4} align="center">No {status.toLowerCase()} ingestions</TableCell></TableRow>
                        )}
                        {ingestions.map((ing) => {
                            const amt = ingestionAmount(ing);
                            return (
                                <TableRow key={ing.id}>
                                    <TableCell>
                                        <Typography variant="body2">{ingestionDisplayText(ing) ?? '(no description)'}</Typography>
                                        <Typography variant="caption" color="text.secondary">{ing.id}</Typography>
                                    </TableCell>
                                    <TableCell>{amt != null ? money(amt) : '—'}</TableCell>
                                    <TableCell>{ingestionDate(ing) ?? '—'}</TableCell>
                                    <TableCell align="right">
                                        {status === 'Pending' && (
                                            <Button size="small" variant="contained" startIcon={<Wallet size={14} />}
                                                onClick={() => { setSelected(ing); setOpen(true); }}>
                                                Process
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            {open && (
                <IngestionProcessDialog
                    key={selected?.id ?? 'none'}
                    open={open}
                    ingestion={selected}
                    onClose={() => setOpen(false)}
                />
            )}
        </Box>
    );
};

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
const statusColor = (s: string): ChipColor =>
    s === 'Completed' ? 'success'
        : s === 'Failed' ? 'error'
            : s === 'Cancelled' ? 'default'
                : s === 'Processing' ? 'info' : 'warning';

const SyncStatusSection: React.FC = () => {
    const { data: items = [], refetch, isFetching } = useFinanceSyncItems();

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>Sync Queue</Typography>
                <IconButton size="small" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw size={16} />
                </IconButton>
            </Box>
            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Kind</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Attempts</TableCell>
                            <TableCell>Finance Tx</TableCell>
                            <TableCell>Detail</TableCell>
                            <TableCell>Updated</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.length === 0 && (
                            <TableRow><TableCell colSpan={6} align="center">No sync activity yet</TableCell></TableRow>
                        )}
                        {items.map(it => (
                            <TableRow key={it.id}>
                                <TableCell>{it.kind}</TableCell>
                                <TableCell><Chip size="small" label={it.status} color={statusColor(it.status)} /></TableCell>
                                <TableCell>{it.attempts}</TableCell>
                                <TableCell>{it.financeTransactionId ?? '—'}</TableCell>
                                <TableCell>
                                    <Typography variant="caption" color={it.lastError ? 'error' : 'text.secondary'}>
                                        {it.lastError ?? ''}
                                    </Typography>
                                </TableCell>
                                <TableCell>{new Date(it.updatedAt).toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

const FinanceSettingsTab: React.FC = () => {
    const { data: balances = [], isLoading } = useLinkedBalances();
    const isMobile = useIsMobile();
    const financeEnabled = isFinanceEnabled();

    const bySection = (section: string) => balances.filter(a => a.section === section);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Typography variant="h5" fontWeight="bold">Finance Integration</Typography>
                <Chip
                    size="small"
                    color={financeEnabled ? 'success' : 'default'}
                    label={financeEnabled ? 'Enabled' : 'Disabled'}
                />
            </Box>
            {!financeEnabled && (
                <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
                    The integration is currently disabled, so nothing is mirrored to finance and
                    notifications can&apos;t be processed yet. You can still configure account links
                    now; flip <code>enableFinanceIntegration</code> on in <code>config.js</code> (and
                    enable it in the backend) to activate it.
                </Alert>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Map loan-app ledger accounts to finance-app accounts. Only entries whose debit and credit
                accounts are both linked are mirrored to finance.
            </Typography>

            {SECTIONS.map(section => {
                const rows = bySection(section);
                if (rows.length === 0) return null;
                return (
                    <Box key={section} sx={{ mb: 4 }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{section}</Typography>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Loan Account</TableCell>
                                        <TableCell align="right">Loan Balance</TableCell>
                                        {!isMobile && <TableCell>Finance Account</TableCell>}
                                        {!isMobile && <TableCell align="right">Finance Balance</TableCell>}
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map(r => (
                                        <LinkRow key={`${r.loanAccountId}:${r.financeAccountId ?? ''}`} row={r} />
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                );
            })}

            {isLoading && <CircularProgress size={24} />}

            {financeEnabled && (
                <>
                    <Divider sx={{ my: 4 }} />
                    <IngestionsSection />
                    <Divider sx={{ my: 4 }} />
                    <SyncStatusSection />
                </>
            )}
        </Box>
    );
};

export default FinanceSettingsTab;
