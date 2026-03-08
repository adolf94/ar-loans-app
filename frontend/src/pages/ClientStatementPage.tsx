import React from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Stack,
    Avatar,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    IconButton,
    Breadcrumbs,
    Link as MuiLink,
    Tooltip,
} from '@mui/material';
import {
    User as UserIcon,
    DollarSign,
    CreditCard,
    TrendingUp,
    ChevronLeft,
    FileText,
    History,
    Landmark,
    Camera
} from 'lucide-react';
import { useParams, Link } from '@tanstack/react-router';
import { useGetUser } from '../repositories/user';
import { useUserLoans } from '../repositories/loan';
import { useEntries } from '../repositories/entry';
import numeral from 'numeral';
import dayjs from 'dayjs';
import { useIsMobile } from '../theme';
import type { Loan } from '../@types/types';

const ClientStatementPage: React.FC = () => {
    const { clientId } = useParams({ strict: false });
    const user = useGetUser(clientId || "");
    const loans = useUserLoans(clientId || "");
    const { data: allEntries = [] } = useEntries();
    const isMobile = useIsMobile();

    const clientSummary = React.useMemo(() => {
        const totalPrincipal = loans.reduce((sum: number, l: Loan) => sum + l.principal, 0);
        const totalBalance = loans.reduce((sum: number, l: Loan) => sum + l.balance, 0);
        const activeLoans = loans.filter((l: Loan) => l.status === 'Active').length;

        return {
            totalPrincipal,
            totalBalance,
            activeLoans,
            totalInterest: totalBalance - totalPrincipal > 0 ? totalBalance - totalPrincipal : 0
        };
    }, [loans]);

    if (!user) return <Box sx={{ p: 4 }}><Typography>Loading user data...</Typography></Box>;

    return (
        <Box sx={{ p: { xs: 1.5, sm: 3, md: 4 } }}>
            {/* Header & Navigation */}
            <Stack spacing={2} sx={{ mb: { xs: 3, md: 4 } }}>
                <Breadcrumbs separator="›" aria-label="breadcrumb">
                    <MuiLink component={Link} to="/admin" color="inherit" sx={{ display: 'flex', alignItems: 'center', fontSize: { xs: '0.8rem', sm: '1rem' } }}>
                        Dashboard
                    </MuiLink>
                    <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: { xs: '0.8rem', sm: '1rem' } }}>
                        <UserIcon size={14} style={{ marginRight: 6 }} />
                        {user.name}
                    </Typography>
                </Breadcrumbs>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <IconButton onClick={() => window.history.back()} sx={{ bgcolor: 'action.hover', width: 40, height: 40 }}>
                            <ChevronLeft size={20} />
                        </IconButton>
                        <Box>
                            <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 800 }}>Account Statement</Typography>
                            <Typography variant="body2" color="text.secondary">Financial history for {user.name}</Typography>
                        </Box>
                    </Stack>
                    <Button
                        variant="outlined"
                        startIcon={<FileText size={18} />}
                        onClick={() => window.print()}
                        sx={{ display: { xs: 'none', sm: 'flex' } }}
                    >
                        Print Statement
                    </Button>
                </Stack>
            </Stack>

            {/* Summary Cards */}
            <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: 4 }}>
                {[
                    { label: 'Total Principal', value: clientSummary.totalPrincipal, icon: <DollarSign size={20} />, color: 'primary.main' },
                    { label: 'Outstanding Balance', value: clientSummary.totalBalance, icon: <CreditCard size={20} />, color: 'error.main' },
                    { label: 'Accrued Interest', value: clientSummary.totalInterest, icon: <TrendingUp size={20} />, color: 'warning.main' },
                    { label: 'Active Agreements', value: clientSummary.activeLoans, icon: <Landmark size={20} />, color: 'info.main', isCount: true },
                ].map((item, idx) => (
                    <Grid size={{ xs: 6, md: 3 }} key={idx}>
                        <Card sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', height: '100%' }}>
                            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                    <Avatar sx={{ bgcolor: `${item.color}15`, color: item.color, width: 32, height: 32 }}>
                                        {React.cloneElement(item.icon as React.ReactElement, { size: 16 })}
                                    </Avatar>
                                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ lineHeight: 1.2 }}>{item.label}</Typography>
                                </Stack>
                                <Typography variant={isMobile ? "h6" : "h5"} fontWeight={800}>
                                    {item.isCount ? item.value : `$${numeral(item.value).format('0,0.0')}`}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Loans & Transactions */}
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Loan History</Typography>

            {loans.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: 'action.hover' }}>
                    <Typography color="text.secondary">No loans found for this client.</Typography>
                </Paper>
            ) : (
                <Stack spacing={3}>
                    {loans.map((loan: Loan) => {
                        const loanTransactions = (loan.transactions || [])
                            .sort((a, b) => dayjs(b.dateStart).unix() - dayjs(a.dateStart).unix());

                        return (
                            <Paper key={loan.id} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                                {/* Loan Header */}
                                <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
                                    <Grid container spacing={2} justifyContent="space-between" alignItems="center">
                                        <Grid size={{ xs: 12, sm: 7 }}>
                                            <Stack direction="row" spacing={2} alignItems="center">
                                                <Box sx={{ p: 1, bgcolor: 'primary.main', borderRadius: 2, color: 'white', display: 'flex' }}>
                                                    <FileText size={isMobile ? 20 : 24} />
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle1" fontWeight={700}>Loan #{loan.alternateId}</Typography>
                                                    <Typography variant="caption" color="text.secondary">Disbursed {dayjs(loan.date).format('MMM DD, YYYY')}</Typography>
                                                </Box>
                                            </Stack>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 5 }}>
                                            <Stack direction="row" spacing={{ xs: 2, sm: 3 }} justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary" display="block">Principal</Typography>
                                                    <Typography variant="body2" fontWeight={700}>${numeral(loan.principal).format('0,0')}</Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary" display="block">Balance</Typography>
                                                    <Typography variant="body2" fontWeight={700} color="error.main">${numeral(loan.balance).format('0,0')}</Typography>
                                                </Box>
                                            </Stack>
                                        </Grid>
                                    </Grid>
                                </Box>

                                {/* Transactions - Table for Desktop, List for Mobile */}
                                {isMobile ? (
                                    <Box>
                                        {loanTransactions.length === 0 ? (
                                            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                                                <Typography variant="body2">No entries recorded</Typography>
                                            </Box>
                                        ) : (
                                            loanTransactions.map((tx, idx) => {
                                                const entry = allEntries.find(e => e.id === tx.ledgerId);
                                                const description = entry?.description || (tx.type.charAt(0).toUpperCase() + tx.type.slice(1));
                                                const hasFile = !!entry?.fileId;

                                                return (
                                                    <Box key={tx.ledgerId} sx={{ p: 2, borderBottom: idx === loanTransactions.length - 1 ? 'none' : '1px solid', borderColor: 'divider' }}>
                                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                            <Box sx={{ flex: 1 }}>
                                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                                                    {dayjs(tx.dateStart).format('MMM DD, YYYY')}
                                                                </Typography>
                                                                <Stack direction="row" spacing={1} alignItems="center">
                                                                    <Typography variant="body2" fontWeight={500}>{description}</Typography>
                                                                    {hasFile && <Camera size={14} color="#6366f1" />}
                                                                </Stack>
                                                            </Box>
                                                            <Typography variant="body2" fontWeight={700} sx={{ color: tx.type === 'payment' ? 'success.main' : 'inherit', ml: 2 }}>
                                                                {tx.type === 'payment' ? '-' : ''}${numeral(tx.amount).format('0,0.00')}
                                                            </Typography>
                                                        </Stack>
                                                    </Box>
                                                );
                                            })
                                        )}
                                    </Box>
                                ) : (
                                    <TableContainer>
                                        <Table size="medium">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {loanTransactions.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                            No entries recorded
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    loanTransactions.map((tx) => {
                                                        const entry = allEntries.find(e => e.id === tx.ledgerId);
                                                        const description = entry?.description || (tx.type.charAt(0).toUpperCase() + tx.type.slice(1));
                                                        const hasFile = !!entry?.fileId;

                                                        return (
                                                            <TableRow key={tx.ledgerId} hover>
                                                                <TableCell>{dayjs(tx.dateStart).format('MMM DD, YYYY')}</TableCell>
                                                                <TableCell>
                                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                                        <Typography variant="body2">{description}</Typography>
                                                                        {hasFile && (
                                                                            <Tooltip title="View Attachment">
                                                                                <Camera size={16} color="#6366f1" style={{ cursor: 'pointer' }} />
                                                                            </Tooltip>
                                                                        )}
                                                                    </Stack>
                                                                </TableCell>
                                                                <TableCell align="right" sx={{ fontWeight: 600, color: tx.type === 'payment' ? 'success.main' : 'inherit' }}>
                                                                    {tx.type === 'payment' ? '-' : ''}${numeral(tx.amount).format('0,0.00')}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Paper>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
};

export default ClientStatementPage;
