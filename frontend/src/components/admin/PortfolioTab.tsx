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
    useMediaQuery,
    useTheme
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

    const handleManage = (loan: Loan) => {
        setSelectedLoan(loan);
        setIsManageOpen(true);
    };

    return (
        <>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)', overflowX: 'auto' }}>
                <Table stickyHeader size={isMobile ? 'small' : 'medium'}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Loan ID</TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Client</TableCell>
                            {!isMobile && <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Principal</TableCell>}
                            <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Balance</TableCell>
                            {!isMobile && <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Rate (% / mo)</TableCell>}
                            <TableCell sx={{ fontWeight: 700, minWidth: 80 }}>Status</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, minWidth: 100 }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loans.map((loan) => (
                            <TableRow key={loan.id} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{loan.alternateId || loan.id}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{dayjs(loan.date).format("MMM DD")}</TableCell>
                                <TableCell>{users.find(u => u.id === loan.clientId)?.name || `ID: ${loan.clientId}`}</TableCell>
                                {!isMobile && <TableCell>P {loan.principal.toLocaleString()}</TableCell>}
                                <TableCell>P {loan.balance.toLocaleString()}</TableCell>
                                {!isMobile && <TableCell>{loan.interestRate}% / mo</TableCell>}
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
                        ))}
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
