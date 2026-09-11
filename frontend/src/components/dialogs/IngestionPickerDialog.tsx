import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Tooltip,
    Button,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    CircularProgress
} from '@mui/material';
import {
    useIngestions,
    ingestionAmount,
    ingestionDate,
    ingestionDisplayText,
    type IngestionRecord
} from '../../repositories/finance';

const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const IngestionPickerDialog: React.FC<{
    open: boolean;
    onClose: () => void;
    onSelect: (record: IngestionRecord) => void;
}> = ({ open, onClose, onSelect }) => {
    const { data: ingestions = [], isLoading } = useIngestions('Pending', open);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ pb: 1 }}>Import from Ingestion</DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
                <TableContainer sx={{ maxHeight: 360 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ py: 0.75 }}>Description</TableCell>
                                <TableCell sx={{ py: 0.75 }} width={100}>Amount</TableCell>
                                <TableCell sx={{ py: 0.75 }} width={100}>Date</TableCell>
                                <TableCell sx={{ py: 0.75 }} align="right" width={72}></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && (
                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 2 }}><CircularProgress size={20} /></TableCell></TableRow>
                            )}
                            {!isLoading && ingestions.length === 0 && (
                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 2 }}>No pending ingestions</TableCell></TableRow>
                            )}
                            {ingestions.map((ing) => {
                                const amt = ingestionAmount(ing);
                                const text = ingestionDisplayText(ing) ?? '(no description)';
                                return (
                                    <TableRow key={ing.id} hover>
                                        <TableCell sx={{ py: 0.5, maxWidth: 260 }}>
                                            <Tooltip title={text} placement="top-start">
                                                <Typography variant="body2" sx={{
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}>
                                                    {text}
                                                </Typography>
                                            </Tooltip>
                                            <Typography variant="caption" color="text.secondary">
                                                {ing.id.slice(0, 8)}…
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ py: 0.5 }}>{amt != null ? money(amt) : '—'}</TableCell>
                                        <TableCell sx={{ py: 0.5 }}>{ingestionDate(ing) ?? '—'}</TableCell>
                                        <TableCell sx={{ py: 0.5 }} align="right">
                                            <Button size="small" variant="contained" onClick={() => onSelect(ing)}>
                                                Use
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
        </Dialog>
    );
};

export default IngestionPickerDialog;
