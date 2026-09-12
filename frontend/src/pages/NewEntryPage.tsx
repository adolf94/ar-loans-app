import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
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
import { Button, Input, Panel, SectionTitle, Select } from '../components/ui';

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
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8">
            <button
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-xs font-mono tracking-wider uppercase text-silverdim hover:text-amber transition-colors"
            >
                <ArrowLeft size={14} />
                Back to inbox
            </button>
            <SectionTitle className="mt-4">New entry</SectionTitle>
            <p className="text-sm text-silverdim mt-1 mb-6">
                Manual double-entry: money leaves one account and arrives in another.
            </p>

            {ingestion && (
                <Panel className="mb-6 !p-3.5">
                    <p className="text-sm font-semibold text-paper">Imported from ingestion</p>
                    <p className="text-xs font-mono text-silverdim mt-0.5">
                        {ingestionDisplayText(ingestion) ?? 'Notification'} · {ingestion.id.slice(0, 8)}…
                    </p>
                </Panel>
            )}

            <Panel className="space-y-4">
                <Input
                    id="entry-date"
                    label="Date"
                    type="date"
                    value={entry.date}
                    onChange={(e) => setEntry({ ...entry, date: e.target.value })}
                />
                <Input
                    id="entry-description"
                    label="Description"
                    value={entry.description}
                    onChange={(e) => setEntry({ ...entry, description: e.target.value })}
                />
                <Input
                    id="entry-amount"
                    label="Amount"
                    type="number"
                    value={entry.amount}
                    onChange={(e) => setEntry({ ...entry, amount: Number(e.target.value) })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-3">
                    <Select
                        id="entry-credit"
                        label="From (Credit)"
                        value={entry.creditId}
                        onChange={(e) => setEntry({ ...entry, creditId: e.target.value })}
                        options={accounts.map((a: Account) => ({ value: a.id, label: a.name }))}
                    />
                    <ArrowRight size={16} className="hidden sm:block text-silverdim mb-3" aria-hidden="true" />
                    <Select
                        id="entry-debit"
                        label="To (Debit)"
                        value={entry.debitId}
                        onChange={(e) => setEntry({ ...entry, debitId: e.target.value })}
                        options={accounts.map((a: Account) => ({ value: a.id, label: a.name }))}
                    />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" onClick={goBack}>Cancel</Button>
                    <Button
                        variant="amber"
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
                </div>
            </Panel>
        </div>
    );
};

export default NewEntryPage;
