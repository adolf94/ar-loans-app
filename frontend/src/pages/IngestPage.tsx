import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Container,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography,
    CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from '@tanstack/react-router';
import {
    useIngestion,
    useIngestions,
    ingestionAmount,
    ingestionDate,
    ingestionDisplayText,
    type IngestionRecord
} from '../repositories/finance';

const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const IngestPage: React.FC = () => {
    const navigate = useNavigate();
    const params = new URLSearchParams(window.location.search);
    const selectedId = params.get('ingestion_id') || undefined;
    const { data: ingestions = [], isLoading } = useIngestions('Pending');
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [closedId, setClosedId] = useState<string | null>(null);
    const selectedRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isLoading && selectedId) selectedRef.current?.scrollIntoView({ block: 'center' });
    }, [isLoading, selectedId]);

    const openModal = !!selectedId && closedId !== selectedId;

    const { data: selectedIngestion, isLoading: ingestionLoading } =
        useIngestion(selectedId, openModal);

    const closeModal = () => {
        setClosedId(selectedId ?? null);
        navigate({ to: '/finance/ingest', search: {} });
    };

    const visible = useMemo(
        () => ingestions.filter(ing => !dismissed.has(ing.id)),
        [ingestions, dismissed]
    );

    const routeTo = (ing: IngestionRecord, to: '/loans/new' | '/payments/new' | '/entries/new') =>
        navigate({ to, search: { ingestion_id: ing.id } });

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Stack spacing={2}>
                <Box>
                    <Typography variant="h5" fontWeight={600}>Ingest</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Pending ingestion records. Choose how to book each one.
                    </Typography>
                </Box>

                {isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}

                {!isLoading && visible.length === 0 && (
                    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">No pending ingestions</Typography>
                    </Paper>
                )}

                {visible.map((ing) => {
                    const amt = ingestionAmount(ing);
                    const date = ingestionDate(ing);
                    const text = ingestionDisplayText(ing) ?? '(no description)';
                    const selected = ing.id === selectedId;
                    return (
                        <Paper
                            key={ing.id}
                            ref={selected ? selectedRef : undefined}
                            variant="outlined"
                            sx={{
                                p: 2,
                                ...(selected && {
                                    borderColor: 'primary.main',
                                    borderWidth: 2,
                                    bgcolor: 'action.selected'
                                })
                            }}
                        >
                            {/* raw_msg + dismiss */}
                            <Stack direction="row" spacing={1} alignItems="flex-start">
                                <Typography variant="body1" sx={{ flexGrow: 1, whiteSpace: 'pre-wrap' }}>
                                    {text}
                                </Typography>
                                <Tooltip title="Dismiss">
                                    <IconButton
                                        size="small"
                                        onClick={() => setDismissed(prev => new Set(prev).add(ing.id))}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>

                            {/* details */}
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                                <Chip size="small" label={amt != null ? money(amt) : '—'} />
                                <Chip size="small" label={date ?? '—'} />
                                <Typography variant="caption" color="text.secondary">
                                    {ing.id.slice(0, 8)}…
                                </Typography>
                            </Stack>

                            {/* routing buttons */}
                            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    sx={{ flexGrow: 1 }}
                                    onClick={() => routeTo(ing, '/loans/new')}
                                >
                                    Loan
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    sx={{ flexGrow: 1 }}
                                    onClick={() => routeTo(ing, '/payments/new')}
                                >
                                    Payment
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    sx={{ flexGrow: 1 }}
                                    onClick={() => routeTo(ing, '/entries/new')}
                                >
                                    Entry
                                </Button>
                            </Stack>
                        </Paper>
                    );
                })}
            </Stack>

            <Dialog open={openModal} onClose={closeModal} maxWidth="xs" fullWidth>
                <DialogTitle>Book ingestion</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    {ingestionLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress size={24} />
                        </Box>
                    )}
                    {!ingestionLoading && !selectedIngestion && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                            Ingestion {selectedId?.slice(0, 8)}… is no longer pending.
                        </Typography>
                    )}
                    {selectedIngestion && (() => {
                        const amt = ingestionAmount(selectedIngestion);
                        return (
                            <>
                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {ingestionDisplayText(selectedIngestion) ?? '(no description)'}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                                    <Chip size="small" label={amt != null ? money(amt) : '—'} />
                                    <Chip size="small" label={ingestionDate(selectedIngestion) ?? '—'} />
                                    <Typography variant="caption" color="text.secondary">
                                        {selectedIngestion.id.slice(0, 8)}…
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                    Choose how to book this record.
                                </Typography>
                            </>
                        );
                    })()}
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: 2, gap: 1 }}>
                    <Button
                        variant="outlined"
                        disabled={!selectedIngestion}
                        sx={{ flexGrow: 1 }}
                        onClick={() => selectedIngestion && routeTo(selectedIngestion, '/loans/new')}
                    >
                        Loan
                    </Button>
                    <Button
                        variant="outlined"
                        disabled={!selectedIngestion}
                        sx={{ flexGrow: 1 }}
                        onClick={() => selectedIngestion && routeTo(selectedIngestion, '/payments/new')}
                    >
                        Payment
                    </Button>
                    <Button
                        variant="contained"
                        disabled={!selectedIngestion}
                        sx={{ flexGrow: 1 }}
                        onClick={() => selectedIngestion && routeTo(selectedIngestion, '/entries/new')}
                    >
                        Entry
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default IngestPage;
