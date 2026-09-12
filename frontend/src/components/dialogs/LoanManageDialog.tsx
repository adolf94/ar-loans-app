import React, { useMemo, useState } from 'react';
import { Button, Dialog, IconButton, Paper, Stamp } from '../ui';

import { Trash2, Receipt, ArrowUpDown, Calendar, User as UserIcon, Wallet, Image as ImageIcon, ChevronDown, ChevronRight } from 'lucide-react';

import type { Loan, User } from '../../@types/types';
import dayjs from 'dayjs';
import { useDeleteLoan } from '../../repositories/loan';
import PaymentDialog from './PaymentDialog';
import { useConfirm } from '../ui';
import { useDeleteEntry, useEntries } from '../../repositories/entry';
import ImageViewerDialog from './ImageViewerDialog';
import AmortizationSchedule from '../AmortizationSchedule';
import CommentSection from '../CommentSection';


interface LoanManageDialogProps {
    open: boolean;
    onClose: () => void;
    loan: Loan | null;
    user: User | null;
    readOnly?: boolean;
}

const LoanManageDialog: React.FC<LoanManageDialogProps> = ({
    open,
    onClose,
    loan,
    user,
    readOnly = false
}) => {
    const deleteLoan = useDeleteLoan();
    const deleteEntry = useDeleteEntry();
    const confirm = useConfirm();
    const { data: entries = [] } = useEntries();
    const [showSchedule, setShowSchedule] = useState(false);

    const entryFileMap = useMemo(() => {
        const map = new Map<string, string>();
        entries.forEach(e => {
            if (e.fileId) map.set(e.id, e.fileId);
        });
        return map;
    }, [entries]);

    if (!loan) return null;

    const handleDeleteLoan = async () => {
        if (await confirm({
            title: 'Confirm Loan Deletion',
            description: 'WARNING: Are you sure you want to PERMANENTLY DELETE this loan and ALL associated transactions? This action will revert all financial effects and cannot be undone.',
            confirmationText: 'Permanently Delete',
            cancellationText: 'Cancel',
        })) {
            await deleteLoan.mutateAsync(loan.id);
            onClose();
        }
    };


    const handleDeleteEntry = async (entryId: string) => {
        if (await confirm({
            title: 'Confirm Entry Deletion',
            description: 'WARNING: Are you sure you want to PERMANENTLY DELETE this entry? This action cannot be undone and will affect account balances.',
            confirmationText: 'Permanently Delete',
            cancellationText: 'Cancel',
        })) {
            await deleteEntry.mutateAsync(entryId);
        }
    }

    const statusTone = loan.status === 'Active' ? 'amber'
        : loan.status === 'Paid' ? 'good'
            : loan.status === 'Defaulted' ? 'bad'
                : 'silver';
    const typeTone = (t: string) => t === 'payment' ? 'good' : t === 'interest' ? 'amber' : t === 'penalty' ? 'bad' : 'safelight';

    const summary = (
        <div className="border border-linestrong rounded-tray bg-bay2/70 p-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
            <div>
                <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim flex items-center gap-1.5"><UserIcon size={13} strokeWidth={1.7} /> Client</p>
                <p className="text-paper font-semibold text-sm mt-1">{user?.name || `ID: ${loan.clientId}`}</p>
            </div>
            <div>
                <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim flex items-center gap-1.5"><Wallet size={13} strokeWidth={1.7} /> Principal</p>
                <p className="text-paper font-semibold text-sm mt-1 tnum font-mono">P {loan.principal.toLocaleString()}</p>
            </div>
            <div>
                <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim flex items-center gap-1.5"><ArrowUpDown size={13} strokeWidth={1.7} /> Current Balance</p>
                <p className="text-amber font-semibold text-sm mt-1 tnum font-mono">P {loan.balance.toLocaleString()}</p>
            </div>
            <div>
                <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim flex items-center gap-1.5"><Calendar size={13} strokeWidth={1.7} /> Date Started</p>
                <p className="text-paper font-semibold text-sm mt-1 font-mono tnum">{dayjs(loan.date).format('MMM DD, YYYY')}</p>
            </div>
        </div>
    );

    const transactions = [...(loan.transactions || [])].sort((a, b) => dayjs(b.dateStart).valueOf() - dayjs(a.dateStart).valueOf());

    return (
        <Dialog open={open} onClose={onClose} width="max-w-3xl">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
                <div className="flex items-center gap-3 min-w-0">
                    <h2 className="text-paper font-semibold text-xl tracking-tight truncate">
                        Manage Loan: {loan.alternateId || loan.id}
                    </h2>
                    <Stamp tone={statusTone} solid={loan.status === 'Defaulted'} dashed={loan.status === 'Pending'} rotate={loan.status === 'Paid' ? -2 : undefined}>
                        {loan.status}
                    </Stamp>
                </div>
                {!readOnly && (
                    <IconButton label="Delete Loan and all transactions" onClick={handleDeleteLoan} className="text-bad hover:text-bad hover:border-bad">
                        <Trash2 size={16} strokeWidth={1.7} />
                    </IconButton>
                )}
            </div>

            <div className="space-y-6">
                {summary}

                {loan.showAmortization && (
                    <div>
                        <button
                            onClick={() => setShowSchedule(!showSchedule)}
                            className="inline-flex items-center gap-1 text-xs font-mono tracking-[0.16em] uppercase text-silverdim hover:text-amber transition-colors"
                        >
                            {showSchedule ? <ChevronDown size={14} strokeWidth={1.7} /> : <ChevronRight size={14} strokeWidth={1.7} />}
                            {showSchedule ? 'Hide' : 'View'} Forthcoming Payments
                        </button>
                        {showSchedule && (
                            <div className="mt-3">
                                <AmortizationSchedule
                                    principal={loan.principal}
                                    interestRate={loan.interestRate}
                                    termMonths={loan.termMonths}
                                    startDate={loan.date}
                                    interestBase={loan.interestBase || 'principal'}
                                />
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim mb-2">Transaction History</p>
                    <Paper className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm min-w-[640px]">
                            <thead className="sticky top-0 bg-paper">
                                <tr className="text-left text-[11px] font-mono tracking-[0.16em] uppercase text-inksoft border-b border-ink/30">
                                    <th className="px-3 py-2.5 font-medium">Date</th>
                                    <th className="px-3 py-2.5 font-medium">Type</th>
                                    <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ink/15">
                                {transactions.length > 0 ? transactions.map((tx) => {
                                    const txFileId = entryFileMap.get(tx.ledgerId);
                                    return (
                                        <tr key={tx.ledgerId} className="hover:bg-ink/5 transition-colors">
                                            <td className="px-3 py-2 font-mono tnum text-ink whitespace-nowrap">{dayjs(tx.dateStart).format('MMM DD, YYYY')}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <Stamp tone={typeTone(tx.type)} className="capitalize">{tx.type}</Stamp>
                                                    {txFileId && (
                                                        <ImageViewerDialog fileId={txFileId}>
                                                            <button title="View screenshot" className="p-1 rounded text-inksoft hover:text-ink transition-colors">
                                                                <ImageIcon size={13} strokeWidth={1.7} />
                                                            </button>
                                                        </ImageViewerDialog>
                                                    )}
                                                    {tx.type == "payment" && !readOnly && (
                                                        <button title="Delete entry" onClick={() => handleDeleteEntry(tx.ledgerId)} className="p-1 rounded text-inksoft hover:text-bad transition-colors">
                                                            <Trash2 size={13} strokeWidth={1.7} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-ink tnum whitespace-nowrap">
                                                {tx.type === 'payment' ? '-' : '+'} P {tx.amount.toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={3} className="px-3 py-6 text-center text-sm text-inksoft italic">
                                            No transactions found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </Paper>
                </div>

                <div>
                    <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim mb-3">Comments & Notes</p>
                    <CommentSection loanId={loan.id} />
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-line flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={onClose}>Close</Button>
                {loan.status === 'Active' && (
                    <PaymentDialog onAddPayment={() => { }} initialLoanId={loan.id} initialUserId={loan.clientId}>
                        <Button variant="amber" startIcon={<Receipt size={16} strokeWidth={1.7} />}>
                            Pay Now
                        </Button>
                    </PaymentDialog>
                )}
            </div>
        </Dialog>
    );
};

export default LoanManageDialog;
