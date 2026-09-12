import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    User as UserIcon,
    ChevronLeft,
    FileText,
    Camera
} from 'lucide-react';
import { useParams, Link } from '@tanstack/react-router';
import { useGetUser } from '../repositories/user';
import { useUserLoans } from '../repositories/loan';
import { useEntries } from '../repositories/entry';
import dayjs from 'dayjs';
import { useIsMobile } from '../theme';
import { Button } from '../components/ui';
import type { Loan } from '../@types/types';

const ClientStatementPage: React.FC = () => {
    const { clientId } = useParams({ strict: false });
    const user = useGetUser(clientId || "");
    const loans = useUserLoans(clientId || "");
    const { data: allEntries = [] } = useEntries();
    const isMobile = useIsMobile();

    const clientSummary = useMemo(() => {
        const totalPrincipal = loans.reduce((sum: number, l: Loan) => sum + l.principal, 0);
        const totalBalance = loans.reduce((sum: number, l: Loan) => sum + l.balance, 0);
        const activeLoans = loans.filter((l: Loan) => l.status === 'Active').length;

        return {
            totalPrincipal,
            totalBalance,
            activeLoans,
            totalInterest: totalBalance - totalPrincipal > 0 ? totalBalance - totalPrincipal : 0
        };
    }, [loans]);

    if (!user) return <div className="p-8 text-sm text-silverdim">Loading user data...</div>;

    return (
        <>
            {createPortal(
                <div className="print-sheet papergrain text-ink rounded-print p-7 sm:p-10 max-w-2xl mx-auto shadow-[0_18px_60px_rgba(0,0,0,.6)] relative z-[1] mt-6 mb-16">
                    <div className="flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
                        <div>
                            <p className="font-bold tracking-[0.28em] text-lg">Statement</p>
                            <p className="text-sm text-inksoft mt-0.5">Statement of account</p>
                        </div>
                        <p className="text-sm text-inksoft text-right">
                            As of {dayjs().format('MMM DD, YYYY')}<br />
                            {user.name} · {clientSummary.activeLoans} active
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 py-5 border-b border-ink/30">
                        <div>
                            <p className="tnum font-bold text-xl">P {clientSummary.totalBalance.toLocaleString()}</p>
                            <p className="text-[11px] font-mono uppercase tracking-wider text-inksoft mt-0.5">Outstanding</p>
                        </div>
                        <div>
                            <p className="tnum font-bold text-xl">P {clientSummary.totalPrincipal.toLocaleString()}</p>
                            <p className="text-[11px] font-mono uppercase tracking-wider text-inksoft mt-0.5">Total principal</p>
                        </div>
                        <div>
                            <p className="tnum font-bold text-xl">P {clientSummary.totalInterest.toLocaleString()}</p>
                            <p className="text-[11px] font-mono uppercase tracking-wider text-inksoft mt-0.5">Accrued interest</p>
                        </div>
                    </div>

                    <h2 className="font-semibold text-lg tracking-tight mt-6">Loan history</h2>

                    {loans.length === 0 ? (
                        <p className="mt-4 text-sm text-inksoft">No loans found for this client.</p>
                    ) : (
                        loans.map((loan: Loan) => {
                            const loanTransactions = (loan.transactions || [])
                                .sort((a, b) => dayjs(b.dateStart).unix() - dayjs(a.dateStart).unix());

                            return (
                                <section key={loan.id} className="mt-6 border-t border-ink/30 pt-4">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                        <div>
                                            <p className="font-semibold flex items-center gap-2">
                                                <FileText size={16} className="text-inksoft shrink-0" />
                                                Loan #{loan.alternateId}
                                            </p>
                                            <p className="font-mono text-[11px] uppercase tracking-wider text-inksoft mt-0.5">
                                                Disbursed {dayjs(loan.date).format('MMM DD, YYYY')}
                                            </p>
                                        </div>
                                        <div className="flex gap-5 text-sm">
                                            <div>
                                                <p className="text-[11px] font-mono uppercase tracking-wider text-inksoft">Principal</p>
                                                <p className="tnum font-bold">P {loan.principal.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-mono uppercase tracking-wider text-inksoft">Balance</p>
                                                <p className="tnum font-bold">P {loan.balance.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {isMobile ? (
                                        <div className="mt-2">
                                            {loanTransactions.length === 0 ? (
                                                <p className="py-3 text-sm text-inksoft">No entries recorded</p>
                                            ) : (
                                                loanTransactions.map((tx, idx) => {
                                                    const entry = allEntries.find(e => e.id === tx.ledgerId);
                                                    const description = entry?.description || (tx.type.charAt(0).toUpperCase() + tx.type.slice(1));
                                                    const hasFile = !!entry?.fileId;

                                                    return (
                                                        <div
                                                            key={tx.ledgerId}
                                                            className={`py-2.5 flex items-start justify-between gap-3 ${idx === loanTransactions.length - 1 ? '' : 'border-b border-ink/15'}`}
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-mono text-[11px] uppercase tracking-wider text-inksoft">
                                                                    {dayjs(tx.dateStart).format('MMM DD, YYYY')}
                                                                </p>
                                                                <p className="text-sm mt-0.5 flex items-center gap-1.5">
                                                                    {description}
                                                                    {hasFile && <Camera size={14} className="text-amberdeep shrink-0" />}
                                                                </p>
                                                            </div>
                                                            <p className="tnum font-semibold text-sm whitespace-nowrap">
                                                                {tx.type === 'payment' ? '-' : ''}P {tx.amount.toLocaleString()}
                                                            </p>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto mt-2">
                                            <table className="w-full text-sm min-w-[640px]">
                                                <thead>
                                                    <tr className="text-left text-[11px] font-mono uppercase tracking-wider text-inksoft border-b border-ink/40">
                                                        <th className="py-2 font-medium">Date</th>
                                                        <th className="py-2 font-medium">Description</th>
                                                        <th className="py-2 text-right font-medium">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-ink/15">
                                                    {loanTransactions.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={3} className="py-3 text-center text-inksoft">No entries recorded</td>
                                                        </tr>
                                                    ) : (
                                                        loanTransactions.map((tx) => {
                                                            const entry = allEntries.find(e => e.id === tx.ledgerId);
                                                            const description = entry?.description || (tx.type.charAt(0).toUpperCase() + tx.type.slice(1));
                                                            const hasFile = !!entry?.fileId;

                                                            return (
                                                                <tr key={tx.ledgerId}>
                                                                    <td className="py-2.5 font-mono text-inksoft whitespace-nowrap">{dayjs(tx.dateStart).format('MMM DD, YYYY')}</td>
                                                                    <td className="py-2.5">
                                                                        <span className="inline-flex items-center gap-1.5">
                                                                            {description}
                                                                            {hasFile && <span title="View attachment"><Camera size={16} className="text-amberdeep" /></span>}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 text-right tnum font-semibold whitespace-nowrap">
                                                                        {tx.type === 'payment' ? '-' : ''}P {tx.amount.toLocaleString()}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </section>
                            );
                        })
                    )}
                </div>,
                document.body
            )}

            <div className="max-w-2xl mx-auto px-5 pt-6 print:hidden">
                <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim flex items-center gap-1.5">
                    <Link to="/admin" className="hover:text-amber transition-colors">Dashboard</Link>
                    <span>›</span>
                    <span className="text-silver flex items-center gap-1.5"><UserIcon size={12} />{user.name}</span>
                </p>

                <div className="mt-4 flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.history.back()}
                            aria-label="Back"
                            className="p-2 border border-line rounded-md text-silver hover:text-amber hover:border-amberdeep transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className={`text-paper font-bold tracking-tight ${isMobile ? 'text-2xl' : 'text-3xl'}`}>Account Statement</h1>
                            <p className="text-sm text-silverdim">Financial history for {user.name}</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        startIcon={<FileText size={16} />}
                        onClick={() => window.print()}
                        className="hidden sm:inline-flex"
                    >
                        Print Statement
                    </Button>
                </div>
            </div>
        </>
    );
};

export default ClientStatementPage;
