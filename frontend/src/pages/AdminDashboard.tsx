import { useState, useMemo } from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Tabs,
    Tab,
    Button,
    Card,
    CardContent,
    Stack,
    Avatar,
    Fab,
    useMediaQuery,
    useTheme
} from '@mui/material';
import PortfolioTab from '../components/admin/PortfolioTab';
import UsersTab from '../components/admin/UsersTab';
import LedgerTab from '../components/admin/LedgerTab';
import BalanceSheetTab from '../components/admin/BalanceSheetTab';
import UserDialog from '../components/dialogs/UserDialog';
import LoanDialog from '../components/dialogs/LoanDialog';
import PaymentDialog from '../components/dialogs/PaymentDialog';
import LedgerDialog from '../components/dialogs/LedgerDialog';
import {
    TrendingUp,
    CreditCard,
    Landmark,
    Sparkles,
    History,
    PieChart,
    DollarSign,
    Briefcase,
    Plus,
    UserPlus,
    FilePlus,
    Wallet
} from 'lucide-react';
import {
    mockLoans,
    mockTransactions,
    mockAccounts,
    mockLedger,
    mockUsers
} from '../mockData';
import { calculateBalanceSheet } from '../logic/accounting';
import { analyzePortfolio } from '../services/aiService';
import { useUsers, useCreateUser, useUpdateUser } from '../repositories/user';
import { useCreateLoan } from '../repositories/loan';
import type { Loan, Transaction, GeneralLedgerEntry, User } from '../@types/types';
import { Users } from 'lucide-react';
import { useAccounts } from '../repositories/account';
import { accountIds } from '../components/accountConstants';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

const AdminDashboard: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [loans, setLoans] = useState<Loan[]>(mockLoans);
    const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
    const [ledger, setLedger] = useState<GeneralLedgerEntry[]>(mockLedger);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // AI Analysis State
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // User Data & Mutations from Repository
    const createUserMutation = useCreateUser();
    const updateUserMutation = useUpdateUser();

    // Dialog States
    const [openLoanDialog, setOpenLoanDialog] = useState(false);
    const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
    const [openLedgerDialog, setOpenLedgerDialog] = useState(false);

    const {data: accounts = []} = useAccounts()


    const summary = useMemo(()=>{
        let assets = accounts.filter(e=>e.section=="Assets").reduce((p,c)=> p + c.balance, 0)
        let receivables = (accounts.find(e=>e.id == accountIds.receivables))?.balance || 0
        let income = accounts.filter(e=>e.section=="Income").reduce((p,c)=> p + c.balance, 0)

        return {
            totalAssets : assets,
            receivables,
            income: income
        }
    },[accounts])


    const editingUser = useMemo(() =>
        null,
        [editingUserId]);


    const balanceSheet = useMemo(() =>
        calculateBalanceSheet(loans, transactions, mockAccounts, ledger),
        [loans, transactions, ledger]
    );

    const stats = useMemo(() => ({
        totalPrincipal: balanceSheet.loanReceivables,
        totalInterestReceivable: balanceSheet.interestReceivables,
        totalRiskExposure: loans.reduce((sum, l) => sum + (l.status === 'Active' ? l.principal : 0), 0),
        healthScore: 85 // Mocked for now
    }), [balanceSheet, loans]);

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

    const handleUpdateUser = (user: User) => {
        if (!editingUserId) return;
        updateUserMutation.mutate({ id: editingUserId, user });
        setEditingUserId(null);
    };

    const handleEditUser = (userId: string) => {
        setEditingUserId(userId);
    };

    const handleAddLoan = (newLoan: Loan) => {
        setLoans([...loans, newLoan]);

        // Add disbursement transaction locally for UI
        const disbursement: Transaction = {
            id: (transactions.length + 1).toString(),
            loanId: newLoan.id,
            amount: newLoan.principal,
            date: newLoan.date,
            type: 'Disbursement',
            description: `Initial disbursement for Loan #${newLoan.id}`
        };
        setTransactions([...transactions, disbursement]);

        // Add to ledger locally for UI
        const ledgerEntry: GeneralLedgerEntry = {
            id: (ledger.length + 1).toString(),
            date: newLoan.date,
            description: `Loan Disbursement - Loan #${newLoan.id}`,
            amount: newLoan.principal,
            isDebit: true,
            accountId: '1' // Loan Receivables
        };
        setLedger([...ledger, ledgerEntry]);


        setOpenLoanDialog(false);
    };

    const handleAddPayment = (payment: Transaction) => {
        setTransactions([...transactions, payment]);

        // Add to ledger
        const ledgerEntry: GeneralLedgerEntry = {
            id: (ledger.length + 1).toString(),
            date: payment.date,
            description: `Loan Payment - Loan #${payment.loanId}`,
            amount: payment.amount,
            isDebit: false,
            accountId: '1' // Loan Receivables
        };
        setLedger([...ledger, ledgerEntry]);

        setOpenPaymentDialog(false);
    };

    const handleAddLedger = (ledgerEntry: GeneralLedgerEntry) => {
        setLedger([...ledger, ledgerEntry]);
    };

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>Lender Overview</Typography>
                <Stack direction="row" spacing={2}>
                    <UserDialog
                        onAddUser={handleAddUser}
                        onUpdateUser={handleUpdateUser}
                        userToEdit={editingUser}
                    >
                        <Button
                            variant="outlined"
                            startIcon={<UserPlus size={18} />}
                        >
                            Add User
                        </Button>
                    </UserDialog>
                    <Button
                        variant="contained"
                        startIcon={<Sparkles size={18} />}
                        onClick={handleAiAnalysis}
                        disabled={isAiLoading}
                        sx={{
                            background: 'linear-gradient(45deg, #7c3aed 30%, #2563eb 90%)',
                            boxShadow: '0 4px 14px 0 rgba(124, 58, 237, 0.39)',
                        }}
                    >
                        {isAiLoading ? 'Analyzing...' : 'AI Portfolio Insights'}
                    </Button>
                </Stack>
            </Stack>

            <Grid container spacing={3} sx={{ mb: 4 }}>
                {[
                    { label: 'Loan Receivables', value: summary.receivables, icon: <DollarSign />, color: 'primary.main' },
                    // { label: 'Interest Receivables', value: balanceSheet.interestReceivables, icon: <TrendingUp size={20} />, color: 'success.main' },
                    { label: 'Liquid Asset', value: summary.totalAssets - summary.receivables, icon: <Landmark />, color: 'info.main' },
                    { label: 'Net Revenue', value: summary.income  , icon: <CreditCard />, color: 'secondary.main' },
                ].map((item, idx) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
                        <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                    <Avatar sx={{ bgcolor: `${item.color}15`, color: item.color }}>{item.icon}</Avatar>
                                </Box>
                                <Typography variant="body2" color="text.secondary" fontWeight={500}>{item.label}</Typography>
                                <Typography variant="h5" fontWeight={700}>${item.value.toLocaleString()}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {aiAnalysis && (
                <Paper sx={{ p: 3, mb: 4, border: '1px solid', borderColor: 'primary.light', bgcolor: 'primary.50' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Sparkles size={20} color="#2563eb" />
                        <Typography variant="h6" color="primary" fontWeight={700}>AI Financial Insight</Typography>
                    </Stack>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{aiAnalysis}</Typography>
                </Paper>
            )}

            <Paper sx={{ width: '100%', borderRadius: 3 }}>
                <Box sx={{
                    borderBottom: 1,
                    borderColor: 'divider',
                    px: { xs: 1, sm: 2 },
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', md: 'center' },
                    gap: { xs: 1, md: 0 }
                }}>
                    <Tabs
                        value={tabValue}
                        onChange={(_, v) => setTabValue(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={{
                            minHeight: { xs: 48, sm: 64 },
                            '& .MuiTab-root': {
                                minHeight: { xs: 48, sm: 64 },
                                fontSize: { xs: '0.75rem', sm: '0.875rem' }
                            }
                        }}
                    >
                        <Tab label="Active Portfolio" icon={<Briefcase size={18} />} iconPosition="start" />
                        <Tab label="System Users" icon={<Users size={18} />} iconPosition="start" />
                        <Tab label="Ledger" icon={<History size={18} />} iconPosition="start" />
                        <Tab label="Balance Sheet" icon={<PieChart size={18} />} iconPosition="start" />
                    </Tabs>
                    <Box sx={{
                        pr: { xs: 0, md: 2 },
                        pb: { xs: 1, md: 0 },
                        display: { xs: 'none', sm: 'block' }
                    }}>
                        {tabValue === 0 && (
                            <LoanDialog
                                onAddLoan={handleAddLoan}
                                currentLoansCount={loans.length}
                            >
                                <Button startIcon={<FilePlus size={18} />}>New Loan</Button>
                            </LoanDialog>
                        )}
                        {tabValue === 2 && (
                            <Stack direction="row" spacing={1}>
                                <PaymentDialog 
                                    onAddPayment={handleAddPayment}
                                    loans={loans}
                                    currentTransactionsCount={transactions.length}>
                                    <Button startIcon={<Wallet size={18} />} >Record Payment</Button>
                                </PaymentDialog>
                            <LedgerDialog
                                onAddLedger={handleAddLedger}
                                currentLedgerCount={ledger.length}
                            >
                                <Button startIcon={<Plus size={18} />} >Manual Entry</Button>
                            </LedgerDialog>
                            </Stack>
                        )}
                    </Box>
                </Box>

                <TabPanel value={tabValue} index={0}>
                    <PortfolioTab />
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <UsersTab  onEditUser={handleEditUser} />
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    <LedgerTab ledger={ledger} />
                </TabPanel>

                <TabPanel value={tabValue} index={3}>
                    <BalanceSheetTab balanceSheet={balanceSheet} />
                </TabPanel>
            </Paper>

            {/* Mobile Floating Action Buttons */}
            {isMobile && (
                <>
                    {tabValue === 0 && (
                        <Fab
                            color="primary"
                            aria-label="new loan"
                            onClick={() => setOpenLoanDialog(true)}
                            sx={{
                                position: 'fixed',
                                bottom: 16,
                                right: 16,
                                zIndex: 1000
                            }}
                        >
                            <FilePlus size={24} />
                        </Fab>
                    )}
                    {tabValue === 2 && (
                        <Stack
                            spacing={1}
                            sx={{
                                position: 'fixed',
                                bottom: 16,
                                right: 16,
                                zIndex: 1000
                            }}
                        >
                            <Fab
                                color="primary"
                                aria-label="record payment"
                                onClick={() => setOpenPaymentDialog(true)}
                                size="medium"
                            >
                                <Wallet size={20} />
                            </Fab>
                            <Fab
                                color="secondary"
                                aria-label="manual entry"
                                onClick={() => setOpenLedgerDialog(true)}
                                size="medium"
                            >
                                <Plus size={20} />
                            </Fab>
                        </Stack>
                    )}
                </>
            )}

            {/* Dialogs */}



        </Box>
    );
};

export default AdminDashboard;
