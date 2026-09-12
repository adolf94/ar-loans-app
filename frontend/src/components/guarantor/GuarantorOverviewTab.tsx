import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Loan } from '../../@types/types';
import GuarantorLoansRow from './GuarantorLoansRow';
import LoanManageDialog from '../dialogs/LoanManageDialog';
import { useGetUser } from '../../repositories/user';
import useUserInfo from '../useUserInfo';
import { useGetUserAccounts } from '../../repositories/bankAccount';
import { useAccounts } from '../../repositories/account';
import { Checkbox, Figure, SectionTitle } from '../ui';
import numeral from 'numeral';
import { useGuaranteedLoans } from '../../repositories/loan';
import { accountIds } from '../accountConstants';

interface GuarantorOverviewTabProps {
    myExposure: {
        totalOriginalRisk: number;
        currentExposure: number;
        riskExposureRate: number;
        clearedAgreements: number;
    };
    guaranteedLoans: Loan[];
}

const GuarantorOverviewTab: React.FC<GuarantorOverviewTabProps> = () => {
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [showClosed, setShowClosed] = useState(false);
    const { userInfo } = useUserInfo()
    const { data: guaranteedLoans = [] } = useGuaranteedLoans(userInfo.userId)

    const filteredLoans = useMemo(() => {
        let sorted = guaranteedLoans.sort((a: Loan, b: Loan) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.id > b.id ? 1 : 0)
        return showClosed ? sorted : sorted.filter((l: Loan) => l.status !== 'Paid');
    }, [guaranteedLoans, showClosed])

    const selectedUser = useGetUser(selectedLoan?.clientId || "");
    const banks = useGetUserAccounts(userInfo.userId)
    const { data: accounts = [] } = useAccounts();

    const handleOpenDialog = (loan: Loan) => {
        setSelectedLoan(loan);
        setOpenDialog(true);
    };

    const onHand = useMemo(() => {
        const userAccountIds = banks.map(e => e.accountId || "")
        return accounts.reduce((p, c) => {
            if (userAccountIds.indexOf(c.id) > -1) return p + c.balance
            return p
        }, 0)
    }, [banks, accounts])

    const completed = useMemo(() => {
        return guaranteedLoans.filter((e: Loan) => e.status.toLowerCase() == "paid").length
    }, [guaranteedLoans])

    const accruedInterest = useMemo(() => {
        const acc = accounts.find(e => e.id === accountIds.accrued_interests);
        return acc ? -acc.balance : 0;
    }, [accounts]);

    const realizedInterest = useMemo(() => {
        const acc = accounts.find(e => e.id === accountIds.realized_interests);
        return acc ? -acc.balance : 0;
    }, [accounts]);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <div title="The total amount that you have on your account of behalf of the coop.">
                    <Figure value={`P ${numeral(onHand).format("0,0")}`} label="Cash on hand" tone="silver" />
                </div>
                <div title="Interest accrued but not yet collected from borrowers you guarantee">
                    <Figure value={`P ${numeral(accruedInterest).format("0,0")}`} label="Accrued interest" tone="bad" />
                </div>
                <Figure value={`P ${numeral(realizedInterest).format("0,0")}`} label="Realized interest" tone="good" />
                <Figure value={String(completed)} label="Agreements cleared" tone="safelight" />
            </div>

            <div className="space-y-3">
                <SectionTitle
                    action={
                        <Checkbox
                            label={`Show paid (${guaranteedLoans.filter((l: Loan) => l.status === 'Paid').length})`}
                            checked={showClosed}
                            onChange={(e) => setShowClosed(e.target.checked)}
                        />
                    }
                >
                    Guarantee Portfolio
                </SectionTitle>

                {filteredLoans.length === 0 ? (
                    <div className="border border-dashed border-linestrong rounded-tray p-6 text-center text-sm text-silverdim">
                        No guaranteed loans to show.
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {filteredLoans.map((loan: Loan) => (
                            <GuarantorLoansRow
                                key={loan.id}
                                loan={loan}
                                onSelect={() => handleOpenDialog(loan)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="border border-dashed border-linestrong rounded-tray p-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber shrink-0 mt-0.5" />
                <p className="text-sm text-silverdim leading-relaxed">
                    Note: Your risk exposure rate is calculated based on the current outstanding principal. In case of borrower default, you are liable for the remaining principal and accrued interest.
                </p>
            </div>

            <LoanManageDialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                loan={selectedLoan}
                user={selectedUser}
                readOnly={true}
            />
        </div>
    );
};

export default GuarantorOverviewTab;
