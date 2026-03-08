import React, { useMemo, useState } from 'react';
import {
    Typography,
    Grid,
    Card,
    CardContent,
    Box,
    Stack,
    Avatar,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    useTheme,
    useMediaQuery,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    AlertTriangle,
    CheckCircle2,
    Activity,
    HelpCircle,
    History,
    Landmark
} from 'lucide-react';
import type { Loan } from '../../@types/types';
import GuarantorLoansRow from './GuarantorLoansRow';
import LoanManageDialog from '../dialogs/LoanManageDialog';
import { useGetUser } from '../../repositories/user';
import useUserInfo from '../useUserInfo';
import { useGetUserAccounts } from '../../repositories/bankAccount';
import { useAccounts } from '../../repositories/account';
import numeral from 'numeral';
import { useIsMobile } from '../../theme';
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
    const isMobile = useIsMobile();
    const { userInfo } = useUserInfo()
    const { data: guaranteedLoans = [] } = useGuaranteedLoans(userInfo.userId)

    const filteredLoans = useMemo(() => {
        let sorted = guaranteedLoans.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.id > b.id ? 1 : 0)
        return showClosed ? sorted : sorted.filter(l => l.status !== 'Paid');
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
        return guaranteedLoans.filter(e => e.status.toLowerCase() == "paid").length
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
        <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
            <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>

                {/* Card 1: Cash on Hand */}
                <Grid size={{ xs: 6, md: 3 }}>
                    <Card sx={{ height: '100%' }} >
                        <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 }, '&:last-child': { pb: { xs: 1.5, sm: 2, md: 3 } } }}>
                            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                    <Avatar sx={{ bgcolor: 'primary.main' }}><Landmark size={20} /></Avatar>
                                </Stack>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Typography variant="body2" color="primary.main" fontWeight={700}>Cash on hand</Typography>
                                    <Tooltip title="The total amount that you have on your account of behalf of the coop.">
                                        <Box sx={{ display: 'flex' }}>
                                            <HelpCircle size={14} color="#2563eb" style={{ cursor: 'help' }} />
                                        </Box>
                                    </Tooltip>
                                </Stack>
                                <Typography variant="h4" fontWeight={800}>${numeral(onHand).format("0,0")}</Typography>
                                <Typography variant="caption" color="text.secondary">Amount held on behalf of the coop</Typography>
                            </Box>
                            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                    <Avatar sx={{ bgcolor: 'primary.main', width: 28, height: 28 }}><Landmark size={14} /></Avatar>
                                    <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ lineHeight: 1.2 }}>Cash on hand</Typography>
                                </Stack>
                                <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.1rem', pl: 0.5 }}>${numeral(onHand).format("0,0")}</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Card 2: Accrued Interest */}
                <Grid size={{ xs: 6, md: 3 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 }, '&:last-child': { pb: { xs: 1.5, sm: 2, md: 3 } } }}>
                            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                    <Avatar sx={{ bgcolor: 'error.main' }}><Activity size={20} /></Avatar>
                                </Stack>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Typography variant="body2" color="error.main" fontWeight={700}>Accrued Interest</Typography>
                                    <Tooltip title="Interest accrued but not yet collected from borrowers you guarantee">
                                        <Box sx={{ display: 'flex' }}>
                                            <HelpCircle size={14} color="#ef4444" style={{ cursor: 'help' }} />
                                        </Box>
                                    </Tooltip>
                                </Stack>
                                <Typography variant="h4" fontWeight={800}>${numeral(accruedInterest).format("0,0")}</Typography>
                                <Typography variant="caption" color="text.secondary">Unpaid interest you are helping manage</Typography>
                            </Box>
                            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                    <Avatar sx={{ bgcolor: 'error.main', width: 28, height: 28 }}><Activity size={14} /></Avatar>
                                    <Typography variant="caption" color="error.main" fontWeight={700} sx={{ lineHeight: 1.2 }}>Accrued</Typography>
                                </Stack>
                                <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.1rem', pl: 0.5 }}>${numeral(accruedInterest).format("0,0")}</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Card 3: Realized Interest */}
                <Grid size={{ xs: 6, md: 3 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 }, '&:last-child': { pb: { xs: 1.5, sm: 2, md: 3 } } }}>
                            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                    <Avatar sx={{ bgcolor: 'success.main' }}><CheckCircle2 size={20} /></Avatar>
                                </Stack>
                                <Typography variant="body2" color="success.main" fontWeight={700}>Realized Interest</Typography>
                                <Typography variant="h4" fontWeight={800}>${numeral(realizedInterest).format("0,0")}</Typography>
                                <Typography variant="caption" color="text.secondary">Total earnings already collected</Typography>
                            </Box>
                            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                    <Avatar sx={{ bgcolor: 'success.main', width: 28, height: 28 }}><CheckCircle2 size={14} /></Avatar>
                                    <Typography variant="caption" color="success.main" fontWeight={700} sx={{ lineHeight: 1.2 }}>Realized</Typography>
                                </Stack>
                                <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.1rem', pl: 0.5 }}>${numeral(realizedInterest).format("0,0")}</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Card 4: Agreements Cleared */}
                <Grid size={{ xs: 6, md: 3 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 }, '&:last-child': { pb: { xs: 1.5, sm: 2, md: 3 } } }}>
                            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                    <Avatar sx={{ bgcolor: 'info.main' }}><History size={20} /></Avatar>
                                </Stack>
                                <Typography variant="body2" color="info.main" fontWeight={700}>Agreements Cleared</Typography>
                                <Typography variant="h4" fontWeight={800}>{completed}</Typography>
                                <Typography variant="caption" color="text.secondary">Number of loans fully repaid</Typography>
                            </Box>
                            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                    <Avatar sx={{ bgcolor: 'info.main', width: 28, height: 28 }}><History size={14} /></Avatar>
                                    <Typography variant="caption" color="info.main" fontWeight={700} sx={{ lineHeight: 1.2 }}>Cleared</Typography>
                                </Stack>
                                <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.1rem', pl: 0.5 }}>{completed}</Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 4, mb: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Guarantee Portfolio</Typography>
                <FormControlLabel
                    control={
                        <Switch
                            size="small"
                            checked={showClosed}
                            onChange={(e) => setShowClosed(e.target.checked)}
                        />
                    }
                    label={
                        <Typography variant="caption" color="text.secondary">
                            Show paid ({guaranteedLoans.filter(l => l.status === 'Paid').length})
                        </Typography>
                    }
                />
            </Stack>
            <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Table size={isMobile ? 'small' : 'medium'}>
                    <TableHead>
                        <TableRow>
                            {isMobile ? (
                                <>
                                    <TableCell sx={{ fontWeight: 700 }}>Borrower</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Balance</TableCell>
                                </>
                            ) : (
                                <>
                                    <TableCell sx={{ fontWeight: 700 }}>Loan Reference</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Borrower</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Original Risk</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            Remaining Exposure
                                            <Tooltip title="Current risk remaining on this specific agreement">
                                                <Box sx={{ display: 'flex' }}>
                                                    <HelpCircle size={14} style={{ cursor: 'help', opacity: 0.6 }} />
                                                </Box>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Details</TableCell>
                                </>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredLoans.map((loan) => (
                            <GuarantorLoansRow
                                key={loan.id}
                                loan={loan}
                                onSelect={() => handleOpenDialog(loan)}
                            />
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Box sx={{ mt: 4, p: 3, borderRadius: 3, border: '1px dashed', borderColor: 'divider', bgcolor: 'grey.50' }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <AlertTriangle color="#f59e0b" />
                    <Typography variant="body2" color="text.secondary">
                        Note: Your risk exposure rate is calculated based on the current outstanding principal. In case of borrower default, you are liable for the remaining principal and accrued interest.
                    </Typography>
                </Stack>
            </Box>

            <LoanManageDialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                loan={selectedLoan}
                user={selectedUser}
                readOnly={true}
            />
        </Box>
    );
};

export default GuarantorOverviewTab;
