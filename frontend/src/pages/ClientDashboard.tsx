import { useMemo, useState } from 'react';
import {
    ArrowUpRight,
    ArrowDownLeft,
    Target,
    ChevronDown,
    ChevronRight,
    AlertCircle
} from 'lucide-react';
import dayjs from 'dayjs';
import useUserInfo from '../components/useUserInfo';
import { useUserLoans } from '../repositories/loan';
import AmortizationSchedule from '../components/AmortizationSchedule';
import { Tabs, Stamp } from '../components/ui';
import type { LoanStatus, Loan, LoanLedger } from '../@types/types';

const statusStamp = (status: LoanStatus) => {
    switch (status) {
        case 'Active': return <Stamp tone="amber">Active</Stamp>;
        case 'Paid': return <Stamp tone="good" rotate={-2}>Paid</Stamp>;
        case 'Defaulted': return <Stamp tone="bad" solid>Defaulted</Stamp>;
        case 'Pending': return <Stamp tone="silver" dashed>Pending</Stamp>;
        default: return <Stamp tone="silver">Archived</Stamp>;
    }
};

interface LoanCardProps {
    loan: Loan & { remaining: number; paid: number; progress: number; transactions: LoanLedger[] };
    getStatusColor: (status: LoanStatus) => "info" | "success" | "default" | "error" | "warning";
}

const LoanCard: React.FC<LoanCardProps> = ({ loan }) => {
    const [showSchedule, setShowSchedule] = useState(false);
    const [showLedger, setShowLedger] = useState(false);
    const pct = loan.progress.toFixed(1);
    const progressFill = loan.status === 'Paid' ? 'bg-good' : loan.status === 'Defaulted' ? 'bg-bad' : 'bg-amberdeep';

    return (
        <article className="papergrain text-ink rounded-print p-5 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.5)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-mono text-[11px] tracking-widest text-inksoft flex items-baseline gap-1.5">
                        <span className="truncate">{loan.alternateId || `#${loan.id.substring(0, 8)}`}</span>
                        <span className="shrink-0">· {loan.interestRate}%/mo</span>
                    </p>
                    <p className="tnum font-bold text-4xl mt-1">P {loan.remaining.toLocaleString()}</p>
                    <p className="text-sm text-inksoft mt-1">
                        left of P {loan.principal.toLocaleString()} · <span className="font-semibold text-ink">{pct}% paid</span>
                    </p>
                </div>
                {statusStamp(loan.status)}
            </div>

            <div className="mt-4">
                <div className="h-2 rounded-full bg-ink/10 overflow-hidden border border-ink/20">
                    <div className={`h-full rounded-full ${progressFill}`} style={{ width: `${Math.min(100, loan.progress)}%` }} />
                </div>
                <p className="mt-1.5 text-right font-mono text-[11px] uppercase tracking-wider text-inksoft tnum">
                    {pct}% · P {loan.remaining.toLocaleString()} to go
                </p>
            </div>

            <div className="mt-4 rounded-print border border-amberdeep/50 bg-amberdeep/10 px-3.5 py-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-inksoft">Payment due</span>
                <span className="text-sm text-inksoft">
                    {loan.termMonths} monthly payments · first on{' '}
                    <span className="font-semibold text-ink">{dayjs(loan.date).add(1, 'month').format('MMM DD, YYYY')}</span>
                </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                    onClick={() => setShowLedger(!showLedger)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-paper bg-ink px-4 py-2.5 rounded-md hover:bg-inksoft transition-colors"
                >
                    {showLedger ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Ledger
                </button>
            </div>

            {showLedger && (
                <div className="mt-4 border-t border-ink/20 pt-3">
                    <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-inksoft flex items-center gap-1.5 mb-1">
                        <Target size={14} /> Recent activity
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[420px]">
                            <thead>
                                <tr className="text-left text-[11px] font-mono uppercase tracking-[0.16em] text-inksoft border-b border-ink/40">
                                    <th className="py-2 font-medium">Date</th>
                                    <th className="py-2 font-medium">Type</th>
                                    <th className="py-2 text-right font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ink/10">
                                {loan.transactions.length > 0 ? (
                                    loan.transactions.map((t: LoanLedger) => (
                                        <tr key={t.ledgerId}>
                                            <td className="py-2 font-mono text-inksoft whitespace-nowrap">{dayjs(t.dateStart).format('MMM DD, YYYY')}</td>
                                            <td className="py-2">
                                                <span className="inline-flex items-center gap-1.5 capitalize">
                                                    {t.type.toLowerCase() === 'payment' ? (
                                                        <ArrowDownLeft size={14} className="text-good shrink-0" />
                                                    ) : t.type.toLowerCase() === 'penalty' ? (
                                                        <AlertCircle size={14} className="text-bad shrink-0" />
                                                    ) : (
                                                        <ArrowUpRight size={14} className="text-inksoft shrink-0" />
                                                    )}
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td className="py-2 text-right tnum font-semibold whitespace-nowrap">P {t.amount.toLocaleString()}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="py-3 text-center text-inksoft">No recent activity</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {loan.showAmortization && (
                <>
                    <div className="border-t border-ink/20 my-4" />
                    <button
                        onClick={() => setShowSchedule(!showSchedule)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amberdeep hover:text-ink transition-colors mb-2"
                    >
                        {showSchedule ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {showSchedule ? 'Hide' : 'View'} Forthcoming Payments
                    </button>
                    {showSchedule && (
                        <AmortizationSchedule
                            principal={loan.principal}
                            interestRate={loan.interestRate}
                            termMonths={loan.termMonths}
                            startDate={loan.date}
                            interestBase={loan.interestBase || 'principal'}
                        />
                    )}
                </>
            )}
        </article>
    );
};

const ClientDashboard: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const { userInfo } = useUserInfo();
    const myLoans = useUserLoans(userInfo.userId);

    const loanDetails = useMemo(() => {
        return myLoans.map((loan: Loan) => {
            const remaining = loan.balance;
            const paid = loan.transactions.reduce((p: number, c: LoanLedger) => {
                if (c.type.toLowerCase() === "payment") return p + c.amount;
                return p;
            }, 0);
            const interest = loan.transactions.reduce((p: number, c: LoanLedger) => {
                if (["interest", "penalty"].includes(c.type.toLowerCase())) return p + c.amount;
                return p;
            }, 0);
            const totalToPay = loan.principal + interest;
            const progress = totalToPay > 0 ? (paid / totalToPay) * 100 : 0;
            const myTransactions = loan.transactions;

            return {
                ...loan,
                remaining,
                paid,
                progress,
                transactions: myTransactions
            };
        });
    }, [myLoans]);

    const activeLoans = loanDetails.filter((l: any) => l.status === 'Active');
    const pastLoans = loanDetails.filter((l: any) => l.status !== 'Active');
    const totalOwed = activeLoans.reduce((s: number, l: any) => s + l.balance, 0);

    const getStatusColor = (status: LoanStatus) => {
        switch (status) {
            case 'Active': return 'info';
            case 'Paid': return 'success';
            case 'Archived': return 'default';
            case 'Defaulted': return 'error';
            default: return 'default';
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-5 pb-16">
            <div className="dev pt-8">
                <p className="text-paper font-bold text-3xl tracking-tight">Good afternoon, {userInfo.name}</p>
                <p className="text-sm text-silverdim mt-1">Your loan agreements and repayment history.</p>
            </div>

            {activeLoans.length > 0 && (
                <div className="dev border-y border-linestrong py-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-6" style={{ animationDelay: '100ms' }}>
                    <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim">You owe</p>
                    <p className="tnum font-bold text-lg text-paper">P {totalOwed.toLocaleString()}</p>
                    <p className="text-sm text-silverdim">across {activeLoans.length} {activeLoans.length === 1 ? 'loan' : 'loans'}</p>
                </div>
            )}

            <div className="dev mt-8" style={{ animationDelay: '150ms' }}>
                <Tabs
                    value={String(tabValue)}
                    onChange={(v) => setTabValue(Number(v))}
                    items={[
                        { value: '0', label: `Active Loans (${activeLoans.length})` },
                        { value: '1', label: `Loan History (${pastLoans.length})` }
                    ]}
                />
                <div className="mt-6 space-y-6">
                    {tabValue === 0 ? (
                        activeLoans.length > 0 ? (
                            activeLoans.map((loan: any, i: number) => (
                                <div
                                    key={loan.id}
                                    className={`dev ${i % 2 ? 'rotate-[0.4deg]' : 'rotate-[-0.5deg]'}`}
                                    style={{ animationDelay: `${i * 120}ms` }}
                                >
                                    <LoanCard loan={loan} getStatusColor={getStatusColor} />
                                </div>
                            ))
                        ) : (
                            <div className="border border-dashed border-linestrong rounded-tray py-8 text-center text-sm text-silverdim">No active loans found.</div>
                        )
                    ) : (
                        pastLoans.length > 0 ? (
                            pastLoans.map((loan: any, i: number) => (
                                <div
                                    key={loan.id}
                                    className={`dev ${i % 2 ? 'rotate-[0.4deg]' : 'rotate-[-0.5deg]'}`}
                                    style={{ animationDelay: `${i * 120}ms` }}
                                >
                                    <LoanCard loan={loan} getStatusColor={getStatusColor} />
                                </div>
                            ))
                        ) : (
                            <div className="border border-dashed border-linestrong rounded-tray py-8 text-center text-sm text-silverdim">No previous loan history found.</div>
                        )
                    )}
                </div>
            </div>

            <div className="mt-10 border-t border-line pt-5 text-center">
                <p className="text-xs text-silverdim">Payments are recorded by your lender. This page is yours to read — nothing to fill, nothing to sign.</p>
            </div>
        </div>
    );
};

export default ClientDashboard;
