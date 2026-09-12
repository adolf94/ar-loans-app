import { useMemo, useState } from 'react';
import GuarantorOverviewTab from '../components/guarantor/GuarantorOverviewTab';
import LedgerTab from '../components/admin/LedgerTab';
import BalanceSheetTab from '../components/admin/BalanceSheetTab';
import { Button, IconButton, Panel, Tabs, Figure } from '../components/ui';
import { FilePlus, Wallet, Plus } from 'lucide-react';
import { mockLoans, mockTransactions, mockAccounts, mockLedger } from '../mockData';
import { calculateGuarantorExposure, calculateBalanceSheet } from '../logic/accounting';
import { useGuaranteedLoans } from '../repositories/loan';
import LedgerDialog from '../components/dialogs/LedgerDialog';
import PaymentDialog from '../components/dialogs/PaymentDialog';
import LoanDialog from '../components/dialogs/LoanDialog';
import useUserInfo from '../components/useUserInfo';
import { useIsMobile } from '../theme';

const P = (n: number) => 'P ' + n.toLocaleString();

const GuarantorDashboard: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const { userInfo } = useUserInfo();
    const isMobile = useIsMobile()

    const myExposure = useMemo(() =>
        calculateGuarantorExposure('3', mockLoans, mockTransactions),
        []);

    const { data: guaranteedLoans = [] } = useGuaranteedLoans(userInfo.userId)
    const balanceSheet = useMemo(() =>
        calculateBalanceSheet(mockLoans, mockTransactions, mockAccounts, mockLedger),
        []
    );

    return (
        <div>
            <div className="dev">
                <h1 className="text-paper font-bold text-3xl tracking-tight">Guarantor Portal</h1>
                <p className="text-sm text-silverdim mt-1">
                    Underwriting Summary for {userInfo.unique_name}. You are providing guarantees for {guaranteedLoans.length} active agreements.
                </p>
            </div>

            <div className="mt-6 border-y border-linestrong py-4 grid grid-cols-3 gap-x-6 gap-y-3 dev" style={{ animationDelay: '100ms' }}>
                <Figure value={P(myExposure.totalOriginalRisk)} label="You guarantee" tone="silver" />
                <Figure value={P(myExposure.currentExposure)} label="At risk now" tone="bad" />
                <Figure value={String(myExposure.clearedAgreements)} label="Released to date" tone="good" />
            </div>

            <Panel pad={false} className="mt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border-b border-line px-1 sm:px-2">
                    <Tabs
                        value={String(tabValue)}
                        onChange={(v) => setTabValue(Number(v))}
                        items={[
                            { value: '0', label: 'Overview' },
                            { value: '1', label: 'Consolidated Ledger' },
                            { value: '2', label: 'Balance Sheet' },
                        ]}
                    />
                    <div className="hidden sm:flex items-center gap-2 px-2 pb-2 md:pb-0">
                        {tabValue === 0 && (<>
                            <LoanDialog
                                currentLoansCount={0}
                                fixedGuarantorId={userInfo.userId}
                                onAddLoan={() => { }}
                            >
                                <Button startIcon={<FilePlus size={18} />}>New Loan</Button>
                            </LoanDialog>
                            <PaymentDialog onAddPayment={() => { }}>
                                <Button variant="outline" startIcon={<Wallet size={18} />}>Record Payment</Button>
                            </PaymentDialog>
                        </>
                        )}
                        {tabValue === 2 && (
                            <LedgerDialog
                                currentLedgerCount={0}
                                onAddLedger={() => { }}
                            >
                                <Button variant="outline" startIcon={<Plus size={18} />}>Manual Entry</Button>
                            </LedgerDialog>
                        )}
                    </div>
                </div>

                {tabValue === 0 && (
                    <GuarantorOverviewTab myExposure={myExposure} guaranteedLoans={guaranteedLoans} />
                )}

                {tabValue === 1 && (
                    <LedgerTab ledger={mockLedger} />
                )}

                {tabValue === 2 && (
                    <BalanceSheetTab balanceSheet={balanceSheet} />
                )}
            </Panel>

            {isMobile && (
                <>
                    {tabValue === 0 && (
                        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
                            <PaymentDialog onAddPayment={() => { }}>
                                <IconButton
                                    label="Record Payment"
                                    className="w-12 h-12 rounded-full justify-center bg-amber text-ink border-amber hover:bg-paper hover:text-ink"
                                >
                                    <Wallet size={20} />
                                </IconButton>
                            </PaymentDialog>
                            <LoanDialog onAddLoan={() => { }} currentLoansCount={0} fixedGuarantorId={userInfo.userId}>
                                <IconButton
                                    label="Issue Loan"
                                    className="w-14 h-14 rounded-full justify-center bg-amber text-ink border-amber hover:bg-paper hover:text-ink"
                                >
                                    <FilePlus size={24} />
                                </IconButton>
                            </LoanDialog>
                        </div>
                    )}
                    {tabValue === 2 && (
                        <div className="fixed bottom-4 right-4 z-50">
                            <LedgerDialog currentLedgerCount={0} onAddLedger={() => { }}>
                                <IconButton
                                    label="Manual Entry"
                                    className="w-12 h-12 rounded-full justify-center bg-amber text-ink border-amber hover:bg-paper hover:text-ink"
                                >
                                    <Plus size={20} />
                                </IconButton>
                            </LedgerDialog>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default GuarantorDashboard;
