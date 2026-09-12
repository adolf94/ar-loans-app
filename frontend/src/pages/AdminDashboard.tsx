import { useState, useMemo } from 'react';
import PortfolioTab from '../components/admin/PortfolioTab';
import UsersTab from '../components/admin/UsersTab';
import LedgerTab from '../components/admin/LedgerTab';
import BalanceSheetTab from '../components/admin/BalanceSheetTab';
import InterestRulesTab from '../components/admin/InterestRulesTab';
import FinanceSettingsTab from '../components/admin/FinanceSettingsTab';
import UserDialog from '../components/dialogs/UserDialog';
import LoanDialog from '../components/dialogs/LoanDialog';
import PaymentDialog from '../components/dialogs/PaymentDialog';
import LedgerDialog from '../components/dialogs/LedgerDialog';
import MessagesTab from '../components/admin/MessagesTab';
import {
    Sparkles,
    Plus,
    UserPlus,
    FilePlus,
    Wallet
} from 'lucide-react';
import { analyzePortfolio } from '../services/aiService';
import { useUsers, useCreateUser, useUpdateUser } from '../repositories/user';
import { useLoans } from '../repositories/loan';
import { useEntries, useCreateEntry } from '../repositories/entry';
import type { User } from '../@types/types';
import { useAccounts } from '../repositories/account';
import { accountIds } from '../components/accountConstants';
import { useIsMobile } from '../theme';
import { Tabs, Button, Panel, SectionTitle, Figure } from '../components/ui';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <div className="pt-6">{children}</div>}
        </div>
    );
}

const AdminDashboard: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [openUserDialog, setOpenUserDialog] = useState(false);

    const isMobile = useIsMobile();
    const { data: accounts = [] } = useAccounts();
    const { data: users = [] } = useUsers();
    const { data: loans = [] } = useLoans();
    const { data: entries = [] } = useEntries();

    // Mutations
    const createUserMutation = useCreateUser();
    const updateUserMutation = useUpdateUser();
    const createEntryMutation = useCreateEntry();

    // AI Analysis State
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const summary = useMemo(() => {
        const assets = accounts.filter(e => e.section === "Assets").reduce((p, c) => p + c.balance, 0);
        const receivables = accounts.find(e => e.id === accountIds.receivables)?.balance || 0;
        const realizedInterest = accounts.find(e => e.id === accountIds.realized_interests)?.balance || 0;
        const accruedInterest = accounts.find(e => e.id === accountIds.accrued_interests)?.balance || 0;

        return {
            totalAssets: assets,
            receivables,
            realizedInterest: -realizedInterest,
            accruedInterest: -accruedInterest
        };
    }, [accounts]);

    const editingUser = useMemo(() =>
        users.find(u => u.id === editingUserId) || null,
        [editingUserId, users]);

    const stats = useMemo(() => ({
        totalPrincipal: summary.receivables,
        totalInterestReceivable: summary.accruedInterest,
        totalRiskExposure: loans.reduce((sum, l) => sum + (l.status === 'Active' ? l.principal : 0), 0),
        healthScore: 85 // Keeping logic consistent
    }), [summary, loans]);

    const handleAiAnalysis = async () => {
        setIsAiLoading(true);
        const result = await analyzePortfolio(loans, stats);
        setAiAnalysis(result);
        setIsAiLoading(false);
    };

    // User Management Functions
    const handleAddUser = (user: User) => {
        createUserMutation.mutate(user);
    };

    const handleUpdateUser = async (user: User) => {
        if (!editingUserId) return;
        await updateUserMutation.mutateAsync({ id: editingUserId, user });
        setEditingUserId(null);
        setOpenUserDialog(false);
    };

    const handleEditUser = (userId: string) => {
        setEditingUserId(userId);
        setOpenUserDialog(true);
    };

    return (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                <SectionTitle>Lender Overview</SectionTitle>
                <div className="flex flex-wrap items-center gap-3">
                    <UserDialog
                        openOverride={openUserDialog}
                        onCloseOverride={() => {
                            setOpenUserDialog(false);
                            setEditingUserId(null);
                        }}
                        onAddUser={handleAddUser}
                        onUpdateUser={handleUpdateUser}
                        userToEdit={editingUser}
                    >
                        <Button variant="outline" startIcon={<UserPlus size={18} strokeWidth={1.7} />} onClick={() => {
                            setEditingUserId(null);
                            setOpenUserDialog(true);
                        }}>
                            Add User
                        </Button>
                    </UserDialog>
                    <Button startIcon={<Sparkles size={18} strokeWidth={1.7} />} onClick={handleAiAnalysis} disabled={isAiLoading} loading={isAiLoading}>
                        {isAiLoading ? 'Analyzing...' : 'AI Portfolio Insights'}
                    </Button>
                </div>
            </div>

            <div className="border-y border-linestrong py-4 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 dev mb-6">
                <Figure value={`P ${summary.receivables.toLocaleString()}`} label="Loan Receivables" tone="silver" />
                <Figure value={`P ${(summary.totalAssets - summary.receivables).toLocaleString()}`} label="Liquid Asset" tone="silver" />
                <Figure value={`P ${summary.realizedInterest.toLocaleString()}`} label="Realized Interest" tone="good" />
                <Figure value={`P ${summary.accruedInterest.toLocaleString()}`} label="Accrued Interest" tone="safelight" />
            </div>

            {aiAnalysis && (
                <Panel className="mb-6 dev">
                    <SectionTitle className="mb-3" action={
                        <button
                            className="text-xs font-mono uppercase tracking-[0.16em] text-amber hover:text-paper transition-colors"
                            onClick={handleAiAnalysis}
                            disabled={isAiLoading}
                        >
                            Read
                        </button>
                    }>
                        Read the room
                    </SectionTitle>
                    <div className="space-y-2">
                        {aiAnalysis.split('\n').filter(line => line.trim()).map((line, i) => (
                            <p key={i} className="hand text-2xl text-paper leading-snug hand-note">{line}</p>
                        ))}
                    </div>
                </Panel>
            )}

            <Panel pad={false} className="overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-0 border-b border-line px-2 sm:px-4">
                    <Tabs
                        value={String(tabValue)}
                        onChange={(v) => setTabValue(Number(v))}
                        items={[
                            { value: '0', label: 'Active Portfolio' },
                            { value: '1', label: 'System Users' },
                            { value: '2', label: 'Ledger' },
                            { value: '3', label: 'Balance Sheet' },
                            { value: '4', label: 'Interest Rules' },
                            { value: '5', label: 'Finance' },
                            { value: '6', label: 'System Messages' }
                        ]}
                        className="flex-1 min-w-0"
                    />
                    <div className="pb-2 md:pb-0 md:pr-2 hidden sm:block">
                        {tabValue === 0 && (
                            <LoanDialog
                                onAddLoan={() => { }}
                                currentLoansCount={loans.length}
                            >
                                <Button size="sm" startIcon={<FilePlus size={18} strokeWidth={1.7} />}>New Loan</Button>
                            </LoanDialog>
                        )}
                        {tabValue === 2 && (
                            <div className="flex gap-2">
                                <PaymentDialog
                                    onAddPayment={() => { }}
                                >
                                    <Button size="sm" startIcon={<Wallet size={18} strokeWidth={1.7} />}>Record Payment</Button>
                                </PaymentDialog>
                                <LedgerDialog
                                    onAddLedger={(e) => createEntryMutation.mutate(e)}
                                    currentLedgerCount={entries.length}
                                >
                                    <Button size="sm" startIcon={<Plus size={18} strokeWidth={1.7} />}>Manual Entry</Button>
                                </LedgerDialog>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-2 sm:px-4">
                    <TabPanel value={tabValue} index={0}>
                        <PortfolioTab />
                    </TabPanel>

                    <TabPanel value={tabValue} index={1}>
                        <UsersTab onEditUser={handleEditUser} />
                    </TabPanel>

                    <TabPanel value={tabValue} index={2}>
                        <LedgerTab />
                    </TabPanel>

                    <TabPanel value={tabValue} index={3}>
                        <BalanceSheetTab />
                    </TabPanel>

                    <TabPanel value={tabValue} index={4}>
                        <InterestRulesTab />
                    </TabPanel>

                    <TabPanel value={tabValue} index={5}>
                        <FinanceSettingsTab />
                    </TabPanel>

                    <TabPanel value={tabValue} index={6}>
                        <MessagesTab />
                    </TabPanel>
                </div>
            </Panel>

            {isMobile && (
                <>
                    {tabValue === 0 && (
                        <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2 sm:hidden">
                            <PaymentDialog onAddPayment={() => { }}>
                                <Button variant="amber" className="!px-3 !py-3 shadow-lg" title="Record Payment" aria-label="record payment">
                                    <Wallet size={20} strokeWidth={1.7} />
                                </Button>
                            </PaymentDialog>
                            <LoanDialog onAddLoan={() => { }} currentLoansCount={0}>
                                <Button variant="amber" className="!px-3.5 !py-3.5 shadow-lg" title="Issue Loan" aria-label="new loan">
                                    <FilePlus size={24} strokeWidth={1.7} />
                                </Button>
                            </LoanDialog>
                        </div>
                    )}
                    {tabValue === 2 && (
                        <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2 sm:hidden">
                            <LedgerDialog currentLedgerCount={0} onAddLedger={(e) => createEntryMutation.mutate(e)}>
                                <Button variant="amber" className="!px-3 !py-3 shadow-lg" title="Manual Entry" aria-label="manual entry">
                                    <Plus size={20} strokeWidth={1.7} />
                                </Button>
                            </LedgerDialog>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AdminDashboard;
