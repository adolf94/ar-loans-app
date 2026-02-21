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
    Paper
} from '@mui/material';
import {
    ArrowUpRight,
    ArrowDownLeft,
    Target,
    History,
    Activity
} from 'lucide-react';
import { mockLoans, mockTransactions } from '../mockData';
import { calculateRemainingPrincipal } from '../logic/accounting';
import type { LoanStatus } from '../@types/types';
import useUserInfo from '../components/useUserInfo';
import { useUserLoans } from '../repositories/loan';

const ClientDashboard: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const {userInfo} = useUserInfo()
    // In a real app, we would filter by currentUser.id
    // For this demo, we assume the logged-in client is Maria (ID: 2)
    const myLoans = useUserLoans("019c5fce-6ccf-7468-89e4-ada699874a66");

    const loanDetails = useMemo(() => {
        return myLoans.map(loan => {
            const remaining = loan.balance
            const paid = loan.transactions.reduce((p,c)=>{
                        if(c.type=="payment") return p + c.amount
                        return p
                   } ,0)
            const interest = loan.transactions.reduce((p,c)=>{
                        if(c.type=="interest") return p + c.amount
                        return p
                   } ,0)
            const progress = (paid / (loan.principal+interest)) * 100;
            const myTransactions = loan.transactions;



            return {
                ...loan,
                remaining,
                paid ,
                progress ,
                transactions: myTransactions
            };
        });
    }, [myLoans]);

    const activeLoans = loanDetails.filter(l => l.status === 'Active');
    const pastLoans = loanDetails.filter(l => l.status !== 'Active');

    const getStatusColor = (status: LoanStatus) => {
        switch (status) {
            case 'Active': return 'info';
            case 'Paid': return 'success';
            case 'Archived': return 'default';
            case 'Defaulted': return 'error';
            default: return 'default';
        }
    };

    const renderLoanCard = (loan: typeof loanDetails[0]) => (
        <Card key={loan.id} sx={{ borderRadius: 4, overflow: 'hidden', mb: 3, border: '1px solid', borderColor: 'divider' }}>
            <Grid container>
                <Grid size={{ xs: 12, md: 4 }} sx={{ bgcolor: loan.status === 'Active' ? 'primary.50' : 'grey.50', p: 4 }}>
                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="overline" color="primary" fontWeight={700}>Loan Reference</Typography>
                            <Typography variant="h5" fontWeight={700}>{loan.alternateId || `#${loan.id.substring(0, 8)}`}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Total Principal</Typography>
                            <Typography variant="h6" fontWeight={700}>${loan.principal.toLocaleString()}</Typography>
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
                            <Typography variant="body2" fontWeight={600}>${loan.paid.toLocaleString()} Paid</Typography>
                            <Typography variant="body2" color="text.secondary">${loan.remaining.toLocaleString()} Remaining</Typography>
                        </Stack>
                        <LinearProgress
                            variant="determinate"
                            value={loan.progress}
                            sx={{ height: 12, borderRadius: 6, bgcolor: 'grey.100' }}
                        />
                        <Typography variant="caption" align="right" display="block" sx={{ mt: 1, fontWeight: 700, color: 'primary.main' }}>
                            {loan.progress.toFixed(1)}% Complete
                        </Typography>
                    </Box>

                    <Typography variant="subtitle1" gutterBottom fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Target size={18} /> Recent Activity
                    </Typography>
                    <TableContainer component={Box}>
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
                                    loan.transactions.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell>{t.dateStart}</TableCell>
                                            <TableCell>
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    {t.type.toLowerCase() === 'payment' ? <ArrowDownLeft size={14} color="#10b981" /> : <ArrowUpRight size={14} color="#ef4444" />}
                                                    <Typography variant="body2">{t.type}</Typography>
                                                </Stack>
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                ${t.amount.toLocaleString()}
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
                </Grid>
            </Grid>
        </Card>
    );

    return (
        <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>Borrower Portal</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Welcome back, Maria. Here's a summary of your loan agreements and repayment history.
            </Typography>

            <Paper sx={{ mb: 4, borderRadius: 3 }}>
                <Tabs
                    value={tabValue}
                    onChange={(_, v) => setTabValue(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                    <Tab label={`Active Loans (${activeLoans.length})`} icon={<Activity size={18} />} iconPosition="start" />
                    <Tab label={`Loan History (${pastLoans.length})`} icon={<History size={18} />} iconPosition="start" />
                </Tabs>

                <Box sx={{ p: 3 }}>
                    {tabValue === 0 ? (
                        activeLoans.length > 0 ? (
                            activeLoans.map(renderLoanCard)
                        ) : (
                            <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No active loans found.</Typography>
                        )
                    ) : (
                        pastLoans.length > 0 ? (
                            pastLoans.map(renderLoanCard)
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
