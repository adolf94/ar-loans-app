import { useMemo, useState } from 'react';
import {
    Typography,
    Grid,
    Card,
    Box,
    LinearProgress,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Tabs,
    Tab,
    Paper,
    Divider,
    Button,
    Collapse
} from '@mui/material';
import {
    ArrowUpRight,
    ArrowDownLeft,
    Target,
    History,
    Activity,
    ChevronDown,
    ChevronRight,
    AlertCircle
} from 'lucide-react';
import dayjs from 'dayjs';
import useUserInfo from '../components/useUserInfo';
import { useUserLoans } from '../repositories/loan';
import AmortizationSchedule from '../components/AmortizationSchedule';
import type { LoanStatus, Loan, LoanLedger } from '../@types/types';

interface LoanCardProps {
    loan: Loan & { remaining: number; paid: number; progress: number; transactions: LoanLedger[] };
    getStatusColor: (status: LoanStatus) => "info" | "success" | "default" | "error" | "warning";
}

const LoanCard: React.FC<LoanCardProps> = ({ loan, getStatusColor }) => {
    const [showSchedule, setShowSchedule] = useState(false);

    return (
        <Card sx={{ borderRadius: 4, overflow: 'hidden', mb: 3, border: '1px solid', borderColor: 'divider' }}>
            <Grid container>
                <Grid size={{ xs: 12, md: 4 }} sx={{ bgcolor: loan.status === 'Active' ? 'primary.50' : 'grey.50', p: 4 }}>
                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="overline" color="primary" fontWeight={700}>Loan Reference</Typography>
                            <Typography variant="h5" fontWeight={700}>{loan.alternateId || `#${loan.id.substring(0, 8)}`}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Total Principal</Typography>
                            <Typography variant="h6" fontWeight={700}>P {loan.principal.toLocaleString()}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
                            <Typography variant="h6" fontWeight={700}>{loan.interestRate}% interest / mo</Typography>
                        </Box>
                        <Chip
                            label={loan.status}
                            color={getStatusColor(loan.status)}
                            variant="filled"
                            sx={{ fontWeight: 700, width: 'fit-content' }}
                        />
                    </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }} sx={{ p: 4 }}>
                    <Typography variant="h6" gutterBottom fontWeight={700}>Repayment Progress</Typography>
                    <Box sx={{ mb: 4 }}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                            <Typography variant="body2" fontWeight={600}>P {loan.paid.toLocaleString()} Paid</Typography>
                            <Typography variant="body2" color="text.secondary">P {loan.remaining.toLocaleString()} Remaining</Typography>
                        </Stack>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, loan.progress)}
                            sx={{ height: 12, borderRadius: 6, bgcolor: 'grey.100' }}
                        />
                        <Typography variant="caption" align="right" display="block" sx={{ mt: 1, fontWeight: 700, color: 'primary.main' }}>
                            {loan.progress.toFixed(1)}% Complete
                        </Typography>
                    </Box>

                    <Typography variant="subtitle1" gutterBottom fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Target size={18} /> Recent Activity
                    </Typography>
                    <TableContainer component={Box} sx={{ mb: 2 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loan.transactions.length > 0 ? (
                                    loan.transactions.map((t: LoanLedger) => (
                                        <TableRow key={t.ledgerId}>
                                            <TableCell>{dayjs(t.dateStart).format('MMM DD, YYYY')}</TableCell>
                                            <TableCell>
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    {t.type.toLowerCase() === 'payment' ? (
                                                        <ArrowDownLeft size={14} color="#10b981" />
                                                    ) : t.type.toLowerCase() === 'penalty' ? (
                                                        <AlertCircle size={14} color="#f43f5e" />
                                                    ) : (
                                                        <ArrowUpRight size={14} color="#ef4444" />
                                                    )}
                                                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{t.type}</Typography>
                                                </Stack>
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                P {t.amount.toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center" sx={{ py: 2, color: 'text.secondary' }}>No recent activity</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {loan.showAmortization && (
                        <>
                            <Divider sx={{ my: 2 }} />
                            <Button
                                size="small"
                                variant="text"
                                onClick={() => setShowSchedule(!showSchedule)}
                                startIcon={showSchedule ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                sx={{ textTransform: 'none', color: 'primary.main', fontWeight: 600, mb: 1 }}
                            >
                                {showSchedule ? 'Hide' : 'View'} Forthcoming Payments
                            </Button>
                            <Collapse in={showSchedule}>
                                <AmortizationSchedule
                                    principal={loan.principal}
                                    interestRate={loan.interestRate}
                                    termMonths={loan.termMonths}
                                    startDate={loan.date}
                                    interestBase={loan.interestBase || 'principal'}
                                />
                            </Collapse>
                        </>
                    )}
                </Grid>
            </Grid>
        </Card>
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
                if (c.type === "payment") return p + c.amount;
                return p;
            }, 0);
            const interest = loan.transactions.reduce((p: number, c: LoanLedger) => {
                if (c.type === "interest" || c.type === "penalty") return p + c.amount;
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
        <Box sx={{ p: { xs: 2, md: 4 } }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>Borrower Portal</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Welcome back, {userInfo.name}. Here's a summary of your loan agreements and repayment history.
            </Typography>

            <Paper sx={{ mb: 4, borderRadius: 3, overflow: 'hidden' }}>
                <Tabs
                    value={tabValue}
                    onChange={(_, v) => setTabValue(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                    <Tab label={`Active Loans (${activeLoans.length})`} icon={<Activity size={18} />} iconPosition="start" />
                    <Tab label={`Loan History (${pastLoans.length})`} icon={<History size={18} />} iconPosition="start" />
                </ Tabs>

                <Box sx={{ p: 3 }}>
                    {tabValue === 0 ? (
                        activeLoans.length > 0 ? (
                            activeLoans.map((loan: any) => <LoanCard key={loan.id} loan={loan} getStatusColor={getStatusColor} />)
                        ) : (
                            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No active loans found.</Typography>
                        )
                    ) : (
                        pastLoans.length > 0 ? (
                            pastLoans.map((loan: any) => <LoanCard key={loan.id} loan={loan} getStatusColor={getStatusColor} />)
                        ) : (
                            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No previous loan history found.</Typography>
                        )
                    )}
                </Box>
            </Paper>
        </Box>
    );
};

export default ClientDashboard;
