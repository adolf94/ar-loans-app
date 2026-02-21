import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    useMediaQuery,
    useTheme,
    Stack
} from '@mui/material';
import { useEntries } from '../../repositories/entry';
import { useAccounts } from '../../repositories/account';

interface LedgerTabProps {
    ledger?: any[]; // Keep for backward compatibility but not used
}

const LedgerTab: React.FC<LedgerTabProps> = () => {
    const { data: entries = [] } = useEntries();
    const { data: accounts = [] } = useAccounts();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Create a map for quick account lookup
    const accountMap = React.useMemo(() => {
        const map = new Map();
        accounts.forEach(account => {
            map.set(account.id, account.name);
        });
        return map;
    }, [accounts]);

    return (
        <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)', overflowX: 'auto' }}>
            <Table stickyHeader size={isMobile ? 'small' : 'medium'}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 700, minWidth: isMobile ? 150 : 250 }}>Description</TableCell>
                        {!isMobile && <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Credit Account</TableCell>}
                        {!isMobile && <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Debit Account</TableCell>}
                        {isMobile && <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>Accounts</TableCell>}
                        <TableCell align="right" sx={{ fontWeight: 700, minWidth: 100 }}>Amount</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {entries.length > 0 ? (
                        entries.map((entry) => (
                            <TableRow key={entry.id} hover>
                                <TableCell>
                                    <Typography variant="body2">{entry.description}</Typography>
                                </TableCell>
                                {!isMobile ? (
                                    <>
                                        <TableCell>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: 'success.main',
                                                    fontWeight: 600
                                                }}
                                            >
                                                {accountMap.get(entry.creditId) || entry.creditId}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: 'error.main',
                                                    fontWeight: 600
                                                }}
                                            >
                                                {accountMap.get(entry.debitId) || entry.debitId}
                                            </Typography>
                                        </TableCell>
                                    </>
                                ) : (
                                    <TableCell>
                                        <Stack spacing={0.5}>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'success.main',
                                                    fontWeight: 600
                                                }}
                                            >
                                                CR: {accountMap.get(entry.creditId) || entry.creditId}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'error.main',
                                                    fontWeight: 600
                                                }}
                                            >
                                                DR: {accountMap.get(entry.debitId) || entry.debitId}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                )}
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600 }}
                                    >
                                        P {entry.amount.toLocaleString()}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={isMobile ? 3 : 4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                No ledger entries found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default LedgerTab;
