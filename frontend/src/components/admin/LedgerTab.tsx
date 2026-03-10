import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
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
    CircularProgress,
    Skeleton
} from '@mui/material';
import { Image as ImageIcon } from 'lucide-react';
import { useEntries, type Entry } from '../../repositories/entry';
import { useAccounts } from '../../repositories/account';
import dayjs from 'dayjs';
import ImageViewerDialog from '../dialogs/ImageViewerDialog';

// Image viewer dialog component

interface LedgerTabProps {
    ledger?: any[]; // Keep for backward compatibility but not used
}

const PAGE_SIZE = 30;
const LOAD_MORE_SIZE = 20;

const LedgerRow = (props: { entry: Entry }) => {
    let entry = props.entry;
    const { data: accounts = [] } = useAccounts();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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

    if (isMobile) {
        return (
            <TableRow key={entry.id} hover>
                <TableCell sx={{ px: 1.5, py: 1 }}>
                    <Stack spacing={0.25}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" fontWeight={600} sx={{ flex: 1, fontSize: '0.8rem' }}>
                                {entry.description}
                            </Typography>
                            {hasFile && (
                                <ImageViewerDialog fileId={entry.fileId}>
                                    <IconButton
                                        size="small"
                                        sx={{ opacity: 0.7, '&:hover': { opacity: 1 }, p: 0.25 }}
                                    >
                                        <ImageIcon size={14} />
                                    </IconButton>
                                </ImageViewerDialog>
                            )}
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                {dayjs(entry.date).format("MMM DD")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">·</Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: credit.color, fontWeight: 600, fontSize: '0.65rem' }}
                            >
                                CR: {credit.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">→</Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: debit.color, fontWeight: 600, fontSize: '0.65rem' }}
                            >
                                DR: {debit.name}
                            </Typography>
                        </Stack>
                    </Stack>
                </TableCell>
                <TableCell align="right" sx={{ px: 1.5, py: 1, whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8rem' }}>
                        P {entry.amount.toLocaleString()}
                    </Typography>
                </TableCell>
            </TableRow>
        );
    }

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
                                    sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                                >
                                    <ImageIcon size={16} />
                                </IconButton>
                            </ImageViewerDialog>
                        </Tooltip>
                    )}
                </Stack>
            </TableCell>
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
    const { data: items = [], isLoading: isLoadingEntries } = useEntries();
    const theme = useTheme();
    const { data: accounts = [], isLoading: isLoadingAccounts } = useAccounts();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isLoading = isLoadingEntries || isLoadingAccounts;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const sentinelRef = useRef<HTMLTableRowElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const entries = useMemo(() => {
        let sorted = items.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.id > b.id ? 1 : 0)
        return sorted
    }, [items])

    // Reset visible count when data changes
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [items]);

    const visibleEntries = useMemo(() => entries.slice(0, visibleCount), [entries, visibleCount]);
    const hasMore = visibleCount < entries.length;

    // IntersectionObserver to auto-load more when sentinel is visible
    const loadMore = useCallback(() => {
        setVisibleCount(prev => Math.min(prev + LOAD_MORE_SIZE, entries.length));
    }, [entries.length]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (observerEntries) => {
                if (observerEntries[0].isIntersecting && hasMore) {
                    loadMore();
                }
            },
            {
                root: containerRef.current,
                rootMargin: '100px',
                threshold: 0.1,
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loadMore]);

    return (
        <TableContainer ref={containerRef} sx={{ maxHeight: 'calc(100vh - 300px)', overflowX: 'auto' }}>
            <Table stickyHeader size={isMobile ? 'small' : 'medium'}>
                <TableHead>
                    <TableRow>
                        {isMobile ? (
                            <>
                                <TableCell sx={{ fontWeight: 700 }}>Entry</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                            </>
                        ) : (
                            <>
                                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 700, minWidth: 250 }}>Description</TableCell>
                                <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Credit Account</TableCell>
                                <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Debit Account</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, minWidth: 100 }}>Amount</TableCell>
                            </>
                        )}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {isLoading ? (
                        [...Array(10)].map((_, i) => (
                            <TableRow key={i}>
                                {isMobile ? (
                                    <>
                                        <TableCell><Skeleton variant="text" width="80%" /><Skeleton variant="text" width="40%" /></TableCell>
                                        <TableCell align="right"><Skeleton variant="text" width="60%" /></TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell><Skeleton variant="text" /></TableCell>
                                        <TableCell><Skeleton variant="text" /></TableCell>
                                        <TableCell><Skeleton variant="text" /></TableCell>
                                        <TableCell><Skeleton variant="text" /></TableCell>
                                        <TableCell align="right"><Skeleton variant="text" /></TableCell>
                                    </>
                                )}
                            </TableRow>
                        ))
                    ) : visibleEntries.length > 0 ? (
                        <>
                            {visibleEntries.map((entry) => <LedgerRow entry={entry} key={entry.id} />)}
                            {hasMore && (
                                <TableRow ref={sentinelRef}>
                                    <TableCell
                                        colSpan={isMobile ? 2 : 5}
                                        align="center"
                                        sx={{ py: 2, border: 'none' }}
                                    >
                                        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                                            <CircularProgress size={16} thickness={5} />
                                            <Typography variant="caption" color="text.secondary">
                                                Showing {visibleCount} of {entries.length} entries
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            )}
                        </>
                    ) : (
                        <TableRow>
                            <TableCell colSpan={isMobile ? 2 : 5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
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

