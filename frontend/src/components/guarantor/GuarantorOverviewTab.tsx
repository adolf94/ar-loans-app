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
    Chip,
    Tooltip,
    useTheme,
    useMediaQuery,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    ShieldCheck,
    AlertTriangle,
    CheckCircle2,
    Activity,
    HelpCircle,
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

interface GuarantorOverviewTabProps {
    myExposure: {
        totalOriginalRisk: number;
        currentExposure: number;
        riskExposureRate: number;
        clearedAgreements: number;
    };
    guaranteedLoans: Loan[];
}

const GuarantorOverviewTab: React.FC<GuarantorOverviewTabProps> = ({ myExposure, guaranteedLoans }) => {
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [showClosed, setShowClosed] = useState(false);

    const filteredLoans = showClosed ? guaranteedLoans : guaranteedLoans.filter(l => l.status !== 'Paid');

    const { userInfo } = useUserInfo()

    // We might want to pass the user context if needed, but for now we'll fetch client user when selected
    const selectedUser = useGetUser(selectedLoan?.clientId || "");
    const banks = useGetUserAccounts(userInfo.userId)
    const { data: accounts = [] } = useAccounts();
    const handleOpenDialog = (loan: Loan) => {
        setSelectedLoan(loan);
        setOpenDialog(true);
    };

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const onHand = useMemo(() => {
        const accountIds = banks.map(e => e.accountId || "")
        return accounts.reduce((p, c) => {
            if (accountIds.indexOf(c.id) > -1) return p + c.balance
            return p
        }, 0)
    }, [banks, accounts])

    const balance = useMemo(() => {
        return guaranteedLoans.reduce((p, c) => {
            return p + c.balance
        }, 0)
    }, [guaranteedLoans])


    const completed = useMemo(() => {
        return guaranteedLoans.filter(e => e.status.toLowerCase() == "paid").length
    }, [guaranteedLoans])



    return (
        <Box sx={{ p: 3 }}>
            <Grid container spacing={3} sx={{ mb: 4 }}>


                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%', border: '1px solid', borderColor: 'error.100' }}>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                <Avatar sx={{ bgcolor: 'primary.main' }}><Landmark size={20} /></Avatar>

                            </Stack>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                                <Typography variant="body2" color="primary.main" fontWeight={700}>Cash on hand</Typography>
                                <Tooltip title="The total amount that you have on your account of behalf of the coop.">
                                    <Box sx={{ display: 'flex' }}>
                                        <HelpCircle size={14} color="#ef4444" style={{ cursor: 'help' }} />
                                    </Box>
                                </Tooltip>
                            </Stack>
                            <Typography variant="h4" fontWeight={800}>${numeral(onHand).format("0,0")}</Typography>
                            <Typography variant="caption" color="text.secondary">The total amount that you have on your account of behalf of the coop.</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%', border: '1px solid', borderColor: 'error.100' }}>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                <Avatar sx={{ bgcolor: 'error.main' }}><Activity size={20} /></Avatar>
                                <Chip
                                    label={`${myExposure.riskExposureRate.toFixed(1)}% Rate`}
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    sx={{ fontWeight: 700 }}
                                />
                            </Stack>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                                <Typography variant="body2" color="error.main" fontWeight={700}>Remaining Exposure</Typography>
                                <Tooltip title="The actual amount you are still liable for if the borrower defaults, after accounting for their repayments.">
                                    <Box sx={{ display: 'flex' }}>
                                        <HelpCircle size={14} color="#ef4444" style={{ cursor: 'help' }} />
                                    </Box>
                                </Tooltip>
                            </Stack>
                            <Typography variant="h4" fontWeight={800}>${numeral(balance).format("0,0")}</Typography>
                            <Typography variant="caption" color="text.secondary">Current risk after borrower repayments</Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%', border: '1px solid', borderColor: 'success.100' }}>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                <Avatar sx={{ bgcolor: 'success.main' }}><CheckCircle2 size={20} /></Avatar>
                            </Stack>
                            <Typography variant="body2" color="success.main" fontWeight={700}>Agreements Cleared</Typography>
                            <Typography variant="h4" fontWeight={800}>{completed}</Typography>
                            <Typography variant="caption" color="text.secondary">Number of loans fully repaid</Typography>
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
