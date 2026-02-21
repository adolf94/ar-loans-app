import React from 'react';
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
    Tooltip
} from '@mui/material';
import {
    ShieldCheck,
    AlertTriangle,
    CheckCircle2,
    Activity,
    ArrowRight,
    HelpCircle
} from 'lucide-react';
import type { Loan } from '../../@types/types';
import GuarantorLoansRow from './GuarantorLoansRow';

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
    return (
        <Box sx={{ p: 3 }}>
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ height: '100%', bgcolor: 'secondary.50', border: '1px solid', borderColor: 'secondary.100' }}>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                <Avatar sx={{ bgcolor: 'secondary.main' }}><ShieldCheck size={20} /></Avatar>
                            </Stack>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                                <Typography variant="body2" color="secondary.main" fontWeight={700}>Contingent Liabilities</Typography>
                                <Tooltip title="Potential liabilities that depend on a future event (like a borrower defaulting). This is the total value you have guaranteed.">
                                    <Box sx={{ display: 'flex' }}>
                                        <HelpCircle size={14} color="#6366f1" style={{ cursor: 'help' }} />
                                    </Box>
                                </Tooltip>
                            </Stack>
                            <Typography variant="h4" fontWeight={800}>${myExposure.totalOriginalRisk.toLocaleString()}</Typography>
                            <Typography variant="caption" color="text.secondary">Total original principal guaranteed</Typography>
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
                            <Typography variant="h4" fontWeight={800}>${myExposure.currentExposure.toLocaleString()}</Typography>
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
                            <Typography variant="h4" fontWeight={800}>{myExposure.clearedAgreements}</Typography>
                            <Typography variant="caption" color="text.secondary">Number of loans fully repaid</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mt: 4 }}>Guarantee Portfolio</Typography>
            <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Table>
                    <TableHead>
                        <TableRow>
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
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {guaranteedLoans.map((loan) => <GuarantorLoansRow loan={loan} />)}
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
        </Box>
    );
};

export default GuarantorOverviewTab;
