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
    Tooltip
} from '@mui/material';
import PortfolioTab from '../components/admin/PortfolioTab';
import UsersTab from '../components/admin/UsersTab';
import LedgerTab from '../components/admin/LedgerTab';
import BalanceSheetTab from '../components/admin/BalanceSheetTab';
import InterestRulesTab from '../components/admin/InterestRulesTab';
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
    Wallet,
    Settings,
    Users
} from 'lucide-react';
import { calculateBalanceSheet } from '../logic/accounting';
import { analyzePortfolio } from '../services/aiService';
import { useUsers, useCreateUser, useUpdateUser } from '../repositories/user';
import { useLoans } from '../repositories/loan';
import { useEntries, useCreateEntry } from '../repositories/entry';
import type { User } from '../@types/types';
import { useAccounts } from '../repositories/account';
import { accountIds } from '../components/accountConstants';
import { useIsMobile } from '../theme';

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
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>Lender Overview</Typography>
                <Stack direction="row" spacing={2}>
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
                        <Button
                            variant="outlined"
                            startIcon={<UserPlus size={18} />}
                            onClick={() => {
                                setEditingUserId(null);
                                setOpenUserDialog(true);
                            }}
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

            <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: 4 }}>
                {[
                    { label: 'Loan Receivables', value: summary.receivables, icon: <DollarSign size={isMobile ? 16 : 24} />, color: 'primary.main' },
                    { label: 'Liquid Asset', value: summary.totalAssets - summary.receivables, icon: <Landmark size={isMobile ? 16 : 24} />, color: 'info.main' },
                    { label: 'Realized Interest', value: summary.realizedInterest, icon: <TrendingUp size={isMobile ? 16 : 24} />, color: 'success.main' },
                    { label: 'Accrued Interest', value: summary.accruedInterest, icon: <CreditCard size={isMobile ? 16 : 24} />, color: 'secondary.main' },
                ].map((item, idx) => (
                    <Grid size={{ xs: 6, sm: 4, md: 3 }} key={idx}>
                        <Card sx={{
                            height: '100%',
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: { xs: 2, sm: 3 },
                        }}>
                            <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 }, '&:last-child': { pb: { xs: 1.5, sm: 2, md: 3 } } }}>
                                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                        <Avatar sx={{ bgcolor: `${item.color}15`, color: item.color }}>{item.icon}</Avatar>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" fontWeight={500}>{item.label}</Typography>
                                    <Typography variant="h5" fontWeight={700}>P {item.value.toLocaleString()}</Typography>
                                </Box>
                                <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                        <Avatar sx={{ bgcolor: `${item.color}15`, color: item.color, width: 28, height: 28 }}>{item.icon}</Avatar>
                                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ lineHeight: 1.2 }}>{item.label}</Typography>
                                    </Stack>
                                    <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem', pl: 0.5 }}>P {item.value.toLocaleString()}</Typography>
                                </Box>
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
                        <Tab label="Interest Rules" icon={<Settings size={18} />} iconPosition="start" />
                    </Tabs>
                    <Box sx={{
                        pr: { xs: 0, md: 2 },
                        pb: { xs: 1, md: 0 },
                        display: { xs: 'none', sm: 'block' }
                    }}>
                        {tabValue === 0 && (
                            <LoanDialog
                                onAddLoan={() => { }}
                                currentLoansCount={loans.length}
                            >
                                <Button startIcon={<FilePlus size={18} />}>New Loan</Button>
                            </LoanDialog>
                        )}
                        {tabValue === 2 && (
                            <Stack direction="row" spacing={1}>
                                <PaymentDialog
                                    onAddPayment={() => { }}
                                >
                                    <Button startIcon={<Wallet size={18} />} >Record Payment</Button>
                                </PaymentDialog>
                                <LedgerDialog
                                    onAddLedger={(e) => createEntryMutation.mutate(e)}
                                    currentLedgerCount={entries.length}
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
            </Paper>

            {isMobile && (
                <>
                    {tabValue === 0 && (
                        <Stack
                            spacing={1}
                            sx={{
                                position: 'fixed',
                                bottom: 16,
                                right: 16,
                                zIndex: 1000,
                                textAlign: "center"
                            }}
                        >
                            <PaymentDialog onAddPayment={() => { }}>
                                <Tooltip title="Record Payment" placement='left' >
                                    <Fab
                                        color="secondary"
                                        aria-label="record payment"
                                        size="medium"
                                    >
                                        <Wallet size={20} />
                                    </Fab>
                                </Tooltip>
                            </PaymentDialog>
                            <LoanDialog onAddLoan={() => { }} currentLoansCount={0} >
                                <Tooltip title="Issue Loan" placement='left' >
                                    <Fab
                                        color="primary"
                                        aria-label="new loan"
                                        size="large"
                                    >
                                        <FilePlus size={24} />
                                    </Fab>
                                </Tooltip>
                            </LoanDialog>
                        </Stack>
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
                            <LedgerDialog currentLedgerCount={0} onAddLedger={(e) => createEntryMutation.mutate(e)}>
                                <Fab
                                    color="secondary"
                                    aria-label="manual entry"
                                    size="medium"
                                >
                                    <Plus size={20} />
                                </Fab>
                            </LedgerDialog>
                        </Stack>
                    )}
                </>
            )}
        </Box>
    );
};

export default AdminDashboard;
