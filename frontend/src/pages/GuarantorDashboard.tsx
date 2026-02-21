import { useMemo, useState } from 'react';
import {
    Typography,
    Box,
    Paper,
    Tabs,
    Tab,
    Stack,
    Button
} from '@mui/material';
import GuarantorOverviewTab from '../components/guarantor/GuarantorOverviewTab';
import LedgerTab from '../components/admin/LedgerTab';
import BalanceSheetTab from '../components/admin/BalanceSheetTab';
import {
    LayoutDashboard,
    History,
    PieChart,
    FilePlus,
    Plus,
    Wallet
} from 'lucide-react';
import { mockLoans, mockTransactions, mockAccounts, mockLedger } from '../mockData';
import { calculateGuarantorExposure, calculateBalanceSheet } from '../logic/accounting';
import { useGuaranteedLoans } from '../repositories/loan';
import LedgerDialog from '../components/dialogs/LedgerDialog';
import PaymentDialog from '../components/dialogs/PaymentDialog';
import LoanDialog from '../components/dialogs/LoanDialog';
import useUserInfo from '../components/useUserInfo';

const GuarantorDashboard: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const { userInfo } = useUserInfo();

    // Assume logged-in guarantor is James (ID: 3)
    const myExposure = useMemo(() =>
        calculateGuarantorExposure('3', mockLoans, mockTransactions),
        []);

    const { data: guaranteedLoans = [] } = useGuaranteedLoans("019c6742-3ed8-717a-8014-9eb17060bb3c")
    const balanceSheet = useMemo(() =>
        calculateBalanceSheet(mockLoans, mockTransactions, mockAccounts, mockLedger),
        []
    );

    return (
        <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>Guarantor Portal</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Underwriting Summary for James. You are providing guarantees for {guaranteedLoans.length} active agreements.
            </Typography>

            <Paper sx={{ width: '100%', borderRadius: 3, mb: 4 }}>
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
                        sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                    >
                        <Tab label="Overview" icon={<LayoutDashboard size={18} />} iconPosition="start" />
                        <Tab label="Consolidated Ledger" icon={<History size={18} />} iconPosition="start" />
                        <Tab label="Balance Sheet" icon={<PieChart size={18} />} iconPosition="start" />
                    </Tabs>

                    <Box sx={{
                        pr: { xs: 0, md: 2 },
                        pb: { xs: 1, md: 0 },
                        display: { xs: 'none', sm: 'block' }
                    }}>
                        {tabValue === 0 && (<>
                            <LoanDialog
                                onAddLoan={() => { }}
                                currentLoansCount={0}
                                fixedGuarantorId={userInfo.userId}
                            >
                                <Button startIcon={<FilePlus size={18} />}>New Loan</Button>
                            </LoanDialog>
                            <PaymentDialog
                                onAddPayment={() => { }}
                                loans={guaranteedLoans}
                                currentTransactionsCount={0}>
                                <Button startIcon={<Wallet size={18} />} >Record Payment</Button>
                            </PaymentDialog>
                        </>
                        )}
                        {tabValue === 2 && (
                            <Stack direction="row" spacing={1}>
                                <LedgerDialog
                                    onAddLedger={(data) => { }}
                                    currentLedgerCount={0}
                                >
                                    <Button startIcon={<Plus size={18} />} >Manual Entry</Button>
                                </LedgerDialog>
                            </Stack>
                        )}
                    </Box>
                </Box>
                {tabValue === 0 && (
                    <GuarantorOverviewTab myExposure={myExposure} guaranteedLoans={guaranteedLoans} />
                )}

                {tabValue === 1 && (
                    <LedgerTab ledger={mockLedger} />
                )}

                {tabValue === 2 && (
                    <BalanceSheetTab balanceSheet={balanceSheet} />
                )}
            </Paper>
        </Box>
    );
};

export default GuarantorDashboard;
