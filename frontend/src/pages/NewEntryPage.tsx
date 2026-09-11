import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Container,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { v7 as uuidv7 } from 'uuid';
import dayjs from 'dayjs';
import { useAccounts, type Account } from '../repositories/account';
import { useCreateEntry } from '../repositories/entry';
import {
    useIngestion,
    ingestionAmount,
    ingestionDate,
    ingestionNote,
    ingestionDisplayText,
    isFinanceEnabled
} from '../repositories/finance';

const NewEntryPage: React.FC = () => {
    const navigate = useNavigate();
    const params = new URLSearchParams(window.location.search);
    const ingestionId = params.get('ingestion_id') || undefined;
    const financeOn = isFinanceEnabled();

    const { data: accounts = [] } = useAccounts();
    const createEntry = useCreateEntry();
    const { data: ingestion } = useIngestion(ingestionId, financeOn);

    const [entry, setEntry] = useState({
        date: dayjs().format('YYYY-MM-DD'),
        description: '',
        amount: 0,
        creditId: '',
        debitId: ''
    });

    // Prefill once from the ingestion record.
    const appliedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!ingestion || appliedRef.current === ingestion.id) return;
        appliedRef.current = ingestion.id;
        setEntry(prev => ({
            ...prev,
            amount: ingestionAmount(ingestion) ?? prev.amount,
            date: ingestionDate(ingestion) ?? prev.date,
            description: ingestionNote(ingestion) ?? prev.description
        }));
    }, [ingestion]);

    const goBack = () => navigate({ to: '/finance/ingest' });

    const handleSubmit = async () => {
        await createEntry.mutateAsync({
            id: uuidv7(),
            date: entry.date,
            description: entry.description,
            amount: entry.amount,
            creditId: entry.creditId,
            debitId: entry.debitId,
            financeIngestionId: ingestionId
        });
        navigate({ to: '/admin' });
    };

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Stack spacing={2}>
                <Typography variant="h5" fontWeight={600}>New Entry</Typography>

                {ingestion && (
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="body2" fontWeight={600}>Imported from ingestion</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {ingestionDisplayText(ingestion) ?? 'Notification'} · {ingestion.id.slice(0, 8)}…
                        </Typography>
                    </Paper>
                )}

                <TextField
                    label="Date"
                    type="date"
                    fullWidth
                    value={entry.date}
                    onChange={(e) => setEntry({ ...entry, date: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                    label="Description"
                    fullWidth
                    value={entry.description}
                    onChange={(e) => setEntry({ ...entry, description: e.target.value })}
                />
                <TextField
                    label="Amount"
                    type="number"
                    fullWidth
                    value={entry.amount}
                    onChange={(e) => setEntry({ ...entry, amount: Number(e.target.value) })}
                />
                <FormControl fullWidth>
                    <InputLabel>From (Credit):</InputLabel>
                    <Select
                        value={entry.creditId}
                        label="From (Credit):"
                        onChange={(e) => setEntry({ ...entry, creditId: e.target.value })}
                    >
                        {accounts.map((a: Account) => (
                            <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl fullWidth>
                    <InputLabel>To (Debit):</InputLabel>
                    <Select
                        value={entry.debitId}
                        label="To (Debit):"
                        onChange={(e) => setEntry({ ...entry, debitId: e.target.value })}
                    >
                        {accounts.map((a: Account) => (
                            <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button onClick={goBack}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={
                            !entry.description
                            || entry.amount <= 0
                            || !entry.creditId
                            || !entry.debitId
                            || entry.creditId === entry.debitId
                            || createEntry.isPending
                        }
                    >
                        {createEntry.isPending ? 'Saving...' : 'Add Entry'}
                    </Button>
                </Box>
            </Stack>
        </Container>
    );
};

export default NewEntryPage;
