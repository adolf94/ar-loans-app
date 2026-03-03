import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Chip,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
    FormControlLabel,
    Switch,
    Box
} from '@mui/material';
import type { User } from '../../@types/types';
import { useLoans } from '../../repositories/loan';
import { useUsers } from '../../repositories/user';
import dayjs from 'dayjs';
import LoanManageDialog from '../dialogs/LoanManageDialog';
import type { Loan } from '../../@types/types';

interface PortfolioTabProps {
    users: User[];
}

const PortfolioTab: React.FC<PortfolioTabProps> = ({ }) => {
    const { data: loans = [] } = useLoans();
    const theme = useTheme();
    const { data: users = [] } = useUsers()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [showClosed, setShowClosed] = useState(false);

    const filteredLoans = showClosed ? loans : loans.filter(l => l.status !== 'Paid');

    const handleManage = (loan: Loan) => {
        setSelectedLoan(loan);
        setIsManageOpen(true);
    };

    return (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
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
                            Show paid loans ({loans.filter(l => l.status === 'Paid').length})
                        </Typography>
                    }
                />
            </Box>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)', overflowX: 'auto' }}>
                <Table stickyHeader size={isMobile ? 'small' : 'medium'}>
                    <TableHead>
                        <TableRow>
                            {isMobile ? (
                                <>
                                    <TableCell sx={{ fontWeight: 700 }}>Loan / Client</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Balance</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, minWidth: 60 }}></TableCell>
                                </>
                            ) : (
                                <>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Loan ID</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Client</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Principal</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Balance</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Rate (% / mo)</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 80 }}>Status</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, minWidth: 100 }}>Actions</TableCell>
                                </>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredLoans.map((loan) => {
                            const clientName = users.find(u => u.id === loan.clientId)?.name || `ID: ${loan.clientId}`;

                            if (isMobile) {
                                return (
                                    <TableRow key={loan.id} hover>
                                        <TableCell>
                                            <Stack spacing={0.25}>
                                                <Typography variant="body2" fontWeight={600}>{clientName}</Typography>
                                                <Stack direction="row" spacing={0.5} alignItems="center">
                                                    <Typography variant="caption" color="text.secondary">
                                                        {loan.alternateId || loan.id}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">·</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {dayjs(loan.date).format("MMM DD")}
                                                    </Typography>
                                                </Stack>
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack spacing={0.25} alignItems="flex-end">
                                                <Typography variant="body2" fontWeight={600}>
                                                    P {loan.balance.toLocaleString()}
                                                </Typography>
                                                <Chip
                                                    label={loan.status}
                                                    size="small"
                                                    color={loan.status === 'Active' ? 'info' : loan.status === 'Paid' ? 'success' : 'default'}
                                                    sx={{ fontWeight: 600, height: 18, fontSize: '0.6rem' }}
                                                />
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="right" sx={{ px: 0.5 }}>
                                            <Button size="small" variant="outlined" onClick={() => handleManage(loan)} sx={{ minWidth: 0, px: 1, fontSize: '0.65rem' }}>
                                                Manage
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            }

                            return (
                                <TableRow key={loan.id} hover>
                                    <TableCell sx={{ fontWeight: 600 }}>{loan.alternateId || loan.id}</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>{dayjs(loan.date).format("MMM DD")}</TableCell>
                                    <TableCell>{clientName}</TableCell>
                                    <TableCell>P {loan.principal.toLocaleString()}</TableCell>
                                    <TableCell>P {loan.balance.toLocaleString()}</TableCell>
                                    <TableCell>{loan.interestRate}% / mo</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={loan.status}
                                            size="small"
                                            color={loan.status === 'Active' ? 'info' : loan.status === 'Paid' ? 'success' : 'default'}
                                            sx={{ fontWeight: 600 }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button size="small" variant="outlined" onClick={() => handleManage(loan)}>Manage</Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            <LoanManageDialog
                open={isManageOpen}
                onClose={() => setIsManageOpen(false)}
                loan={selectedLoan}
                user={selectedLoan ? users.find(u => u.id === selectedLoan.clientId) || null : null}
            />
        </>
    );
};

export default PortfolioTab;
