import React, { useMemo, useState } from 'react';
import type { User } from '../../@types/types';
import { useLoans } from '../../repositories/loan';
import { useUsers } from '../../repositories/user';
import dayjs from 'dayjs';
import LoanManageDialog from '../dialogs/LoanManageDialog';
import type { Loan } from '../../@types/types';
import { Button, Checkbox, Panel, Stamp, Skeleton } from '../ui';

interface PortfolioTabProps {
    users?: User[];
}

const statusStamp = (status: string) => {
    switch (status) {
        case 'Active':
            return <Stamp tone="amber">{status}</Stamp>;
        case 'Paid':
            return <Stamp tone="good" rotate={-2}>{status}</Stamp>;
        case 'Overdue':
            return <Stamp tone="bad" dashed rotate={2}>{status}</Stamp>;
        case 'Defaulted':
            return <Stamp tone="bad" solid>{status}</Stamp>;
        case 'Pending':
            return <Stamp tone="silver" dashed>{status}</Stamp>;
        default:
            return <Stamp tone="silver">{status}</Stamp>;
    }
};

const PortfolioTab: React.FC<PortfolioTabProps> = ({ }) => {
    const { data: loans = [], isLoading: isLoadingLoans } = useLoans();
    const { data: users = [], isLoading: isLoadingUsers } = useUsers()
    const isLoading = isLoadingLoans || isLoadingUsers;

    const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [showClosed, setShowClosed] = useState(false);

    const filteredLoans = useMemo(() => {
        let sorted = [...loans].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.id > b.id ? 1 : 0)
        return showClosed ? sorted : sorted.filter(l => l.status !== 'Paid');
    }, [loans, showClosed]);

    const selectedLoan = useMemo(() =>
        loans.find(l => l.id === selectedLoanId) || null
        , [loans, selectedLoanId]);

    const handleManage = (loan: Loan) => {
        setSelectedLoanId(loan.id);
        setIsManageOpen(true);
    };

    return (
        <>
            <div className="flex justify-end mb-2">
                <Checkbox
                    label={`Show paid loans (${loans.filter(l => l.status === 'Paid').length})`}
                    checked={showClosed}
                    onChange={(e) => setShowClosed(e.target.checked)}
                />
            </div>
            <div className="max-h-[calc(100vh-300px)] overflow-x-auto">
                <Panel pad={false} className="min-w-[640px] overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim border-b border-linestrong">
                                <th className="px-4 py-3 font-medium">Loan ID</th>
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Client</th>
                                <th className="px-4 py-3 font-medium text-right">Principal</th>
                                <th className="px-4 py-3 font-medium text-right">Balance</th>
                                <th className="px-4 py-3 font-medium">Rate (% / mo)</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line/70">
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                                        <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                                        <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                                        <td className="px-4 py-3"><Skeleton className="h-6 w-16" /></td>
                                        <td className="px-4 py-3"><Skeleton className="h-8 w-20 ml-auto" /></td>
                                    </tr>
                                ))
                            ) : filteredLoans.map((loan) => {
                                const clientName = users.find(u => u.id === loan.clientId)?.name || `ID: ${loan.clientId}`;

                                return (
                                    <tr key={loan.id} className="hover:bg-tray/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-paper font-semibold tnum">{loan.alternateId || loan.id}</td>
                                        <td className="px-4 py-3 font-mono text-silverdim whitespace-nowrap">{dayjs(loan.date).format("MMM DD")}</td>
                                        <td className="px-4 py-3 text-paper">{clientName}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-paper tnum">P {loan.principal.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-paper tnum">P {loan.balance.toLocaleString()}</td>
                                        <td className="px-4 py-3 font-mono text-silver tnum">{loan.interestRate}% / mo</td>
                                        <td className="px-4 py-3">{statusStamp(loan.status)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button size="sm" variant="outline" onClick={() => handleManage(loan)}>Manage</Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {!isLoading && filteredLoans.length === 0 && (
                        <div className="border border-dashed border-linestrong rounded-tray m-4 p-6 text-center text-sm text-silverdim">
                            No loans on the line yet.
                        </div>
                    )}
                </Panel>
            </div>
            <LoanManageDialog
                open={isManageOpen}
                onClose={() => {
                    setIsManageOpen(false);
                    setSelectedLoanId(null);
                }}
                loan={selectedLoan}
                user={selectedLoan ? users.find(u => u.id === selectedLoan.clientId) || null : null}
            />
        </>
    );
};

export default PortfolioTab;
