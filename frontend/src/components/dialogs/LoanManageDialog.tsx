import React, { useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Stack,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    IconButton,
    Tooltip,
    Divider
} from '@mui/material';
import { Trash2, Receipt, ArrowUpDown, Calendar, User as UserIcon, Wallet, Image as ImageIcon } from 'lucide-react';
import type { Loan, User } from '../../@types/types';
import dayjs from 'dayjs';
import { useDeleteLoan } from '../../repositories/loan';
import PaymentDialog from './PaymentDialog';
import { useConfirm } from 'material-ui-confirm';
import { useDeleteEntry, useEntries } from '../../repositories/entry';
import ImageViewerDialog from './ImageViewerDialog';

interface LoanManageDialogProps {
    open: boolean;
    onClose: () => void;
    loan: Loan | null;
    user: User | null;
    readOnly?: boolean;
}

const LoanManageDialog: React.FC<LoanManageDialogProps> = ({
    open,
    onClose,
    loan,
    user,
    readOnly = false
}) => {
    const deleteLoan = useDeleteLoan();
    const deleteEntry = useDeleteEntry();
    const confirm = useConfirm();
    const { data: entries = [] } = useEntries();

    // Build a map from entry ID to fileId for quick lookup
    const entryFileMap = useMemo(() => {
        const map = new Map<string, string>();
        entries.forEach(e => {
            if (e.fileId) map.set(e.id, e.fileId);
        });
        return map;
    }, [entries]);

    if (!loan) return null;

    const handleDeleteLoan = async () => {
        try {
            var response = await confirm({
                title: 'Confirm Loan Deletion',
                description: 'WARNING: Are you sure you want to PERMANENTLY DELETE this loan and ALL associated transactions? This action will revert all financial effects and cannot be undone.',
                confirmationText: 'Permanently Delete',
                cancellationText: 'Cancel',
                confirmationButtonProps: { color: 'error', variant: 'contained' },
            });

            if (response.confirmed) {
                await deleteLoan.mutateAsync(loan.id);
                onClose();
            }
        } catch (e) {
            // Cancelled
        }
    };

    const handleDeleteEntry = async (entryId: string) => {
        var response = await confirm({
            title: 'Confirm Loan Deletion',
            description: 'WARNING: Are you sure you want to PERMANENTLY DELETE this entry ? This action cannot be undone.',
            confirmationText: 'Permanently Delete',
            cancellationText: 'Cancel',
            confirmationButtonProps: { color: 'error', variant: 'contained' },
        });

        if (response.confirmed) {
            await deleteEntry.mutateAsync(entryId);
            onClose();
        }
    }



    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" fontWeight={700}>
                        Manage Loan: {loan.alternateId || loan.id}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                            label={loan.status}
                            color={loan.status === 'Active' ? 'info' : loan.status === 'Paid' ? 'success' : 'default'}
                            size="small"
                            sx={{ fontWeight: 600 }}
                        />
                        {!readOnly && (
                            <Tooltip title="Delete Loan and all transactions">
                                <IconButton size="small" color="error" onClick={handleDeleteLoan}>
                                    <Trash2 size={18} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    {/* Loan Summary Header */}
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <UserIcon size={14} /> Client
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>{user?.name || `ID: ${loan.clientId}`}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Wallet size={14} /> Principal
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>P {loan.principal.toLocaleString()}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <ArrowUpDown size={14} /> Current Balance
                                </Typography>
                                <Typography variant="body2" fontWeight={600} color="primary.main">P {loan.balance.toLocaleString()}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Calendar size={14} /> Date Started
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>{dayjs(loan.date).format('MMM DD, YYYY')}</Typography>
                            </Box>
                        </Box>
                    </Paper>

                    <Divider>
                        <Typography variant="overline" color="text.secondary" fontWeight={700}>
                            Transaction History
                        </Typography>
                    </Divider>

                    {/* Transaction History Table */}
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loan.transactions && loan.transactions.length > 0 ? (
                                    [...loan.transactions].sort((a, b) => dayjs(b.dateStart).valueOf() - dayjs(a.dateStart).valueOf()).map((tx) => {
                                        const txFileId = entryFileMap.get(tx.ledgerId);
                                        return (
                                            <TableRow key={tx.ledgerId} hover>
                                                <TableCell>{dayjs(tx.dateStart).format('MMM DD, YYYY')}</TableCell>
                                                <TableCell>
                                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                                        <Chip
                                                            label={tx.type}
                                                            size="small"
                                                            variant="outlined"
                                                            onDelete={(tx.type == "payment" && !readOnly) ? () => {
                                                                handleDeleteEntry(tx.ledgerId)
                                                            } : undefined}
                                                            color={tx.type === 'payment' ? 'success' : tx.type === 'interest' ? 'warning' : 'primary'}
                                                            sx={{ textTransform: 'capitalize', height: 20, fontSize: '0.65rem' }}
                                                        />
                                                        {txFileId && (
                                                            <ImageViewerDialog fileId={txFileId}>
                                                                <Tooltip title="View screenshot">
                                                                    <IconButton size="small" sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}>
                                                                        <ImageIcon size={14} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </ImageViewerDialog>
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                    {tx.type === 'payment' ? '-' : '+'} P {tx.amount.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                                            <Typography variant="body2" color="text.secondary italic">
                                                No transactions found
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} variant="outlined">Close</Button>
                {loan.status === 'Active' && (
                    <PaymentDialog onAddPayment={() => { }} initialLoanId={loan.id} initialUserId={loan.clientId}>
                        <Button variant="contained" startIcon={<Receipt size={18} />}>
                            Pay Now
                        </Button>
                    </PaymentDialog>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default LoanManageDialog;
