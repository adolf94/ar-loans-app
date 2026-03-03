import React, { useState, useMemo, type JSX } from 'react';
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
    Stack,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    CircularProgress
} from '@mui/material';
import { Image as ImageIcon, X } from 'lucide-react';
import { useEntries, type Entry } from '../../repositories/entry';
import { useAccounts } from '../../repositories/account';
import dayjs from 'dayjs';
import ImageViewerDialog from '../dialogs/ImageViewerDialog';

// Image viewer dialog component

interface LedgerTabProps {
    ledger?: any[]; // Keep for backward compatibility but not used
}

const LedgerRow = (props: { entry: Entry }) => {
    let entry = props.entry;
    const { data: accounts = [] } = useAccounts();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [imageOpen, setImageOpen] = useState(false);

    const hasFile = !!entry.fileId && entry.fileId !== '';

    const credit = useMemo(() => {
        let item = accounts.find(e => e.id == entry.creditId);

        return {
            ...item,
            color: !item ? "info.main" : ["Asset", "Income"].indexOf(item?.section) > -1 ? "success.main"
                : "error.main"
        };

    }, [entry]);

    const debit = useMemo(() => {
        let item = accounts.find(e => e.id == entry.debitId);

        return {
            ...item,
            color: !item ? "info.main" : ["Asset", "Income"].indexOf(item?.section) > -1 ? "error.main" : "success.main"
        };
    }, [entry]);

    return <>
        <TableRow key={entry.id} hover>
            <TableCell>
                <Typography variant="body2">{dayjs(entry.date).format("MMM DD")}</Typography>
            </TableCell>
            <TableCell>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2">{entry.description}</Typography>
                    {hasFile && (
                        <Tooltip title="View screenshot">
                            <ImageViewerDialog fileId={entry.fileId}>
                                <IconButton
                                    size="small"
                                    onClick={() => setImageOpen(true)}
                                    sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                                >
                                    <ImageIcon size={16} />
                                </IconButton>
                            </ImageViewerDialog>
                        </Tooltip>
                    )}
                </Stack>
            </TableCell>
            {!isMobile ? (
                <>
                    <TableCell>
                        <Typography
                            variant="body2"
                            sx={{
                                color: credit.color,
                                fontWeight: 600
                            }}
                        >
                            {credit.name}
                        </Typography>
                    </TableCell>
                    <TableCell>
                        <Typography
                            variant="body2"
                            sx={{
                                color: debit.color,
                                fontWeight: 600
                            }}
                        >
                            {debit.name}
                        </Typography>
                    </TableCell>
                </>
            ) : (
                <TableCell>
                    <Stack spacing={0.5}>
                        <Typography
                            variant="caption"
                            sx={{
                                color: credit.color,
                                fontWeight: 600
                            }}
                        >
                            CR: {credit.name}
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                color: debit.color,
                                fontWeight: 600
                            }}
                        >
                            DR: {debit.name}
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
    </>;
};


const LedgerTab: React.FC<LedgerTabProps> = () => {
    const { data: entries = [] } = useEntries();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Create a map for quick account lookup


    return (
        <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)', overflowX: 'auto' }}>
            <Table stickyHeader size={isMobile ? 'small' : 'medium'}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: isMobile ? 150 : 250 }}>Description</TableCell>
                        {!isMobile && <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Credit Account</TableCell>}
                        {!isMobile && <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Debit Account</TableCell>}
                        {isMobile && <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>Accounts</TableCell>}
                        <TableCell align="right" sx={{ fontWeight: 700, minWidth: 100 }}>Amount</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {entries.length > 0 ? (
                        entries.map((entry) => <LedgerRow entry={entry} key={entry.id} />)
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
