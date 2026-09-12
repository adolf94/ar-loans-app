import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import {
    useIngestion,
    useIngestions,
    ingestionAmount,
    ingestionDate,
    ingestionDisplayText,
    type IngestionRecord
} from '../repositories/finance';
import { Button, Dialog, IconButton, Panel, Paper, Spinner } from '../components/ui';

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
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8">
            <div className="dev">
                <h1 className="text-paper font-bold text-3xl tracking-tight">Ingest</h1>
                <p className="text-sm text-silverdim mt-1">
                    Pending ingestion records. Choose how to book each one.
                </p>
            </div>

            <div className="mt-6 space-y-3">
                {isLoading && (
                    <div className="flex justify-center py-6">
                        <Spinner size={24} />
                    </div>
                )}

                {!isLoading && visible.length === 0 && (
                    <div className="border border-dashed border-linestrong rounded-tray p-6 text-center text-sm text-silverdim">
                        No pending ingestions
                    </div>
                )}

                {visible.map((ing, i) => {
                    const amt = ingestionAmount(ing);
                    const date = ingestionDate(ing);
                    const text = ingestionDisplayText(ing) ?? '(no description)';
                    const selected = ing.id === selectedId;
                    const source = ing.sourceType || ing.channel || 'Notification';
                    return (
                        <div key={ing.id} ref={selected ? selectedRef : undefined}>
                            <Panel
                                className={`dev flex flex-wrap items-start gap-4 ${selected ? 'border-amber' : ''}`}
                                style={{ animationDelay: `${i * 70}ms` }}
                            >
                                <div className="min-w-0 flex-1 basis-64">
                                    <p className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-amber">{source}</span>
                                        <span className="text-silverdim font-mono text-xs tnum">{date ?? '—'}</span>
                                        <span className="text-silverdim font-mono text-xs tnum">{amt != null ? money(amt) : '—'}</span>
                                        <span className="text-silverdim font-mono text-xs">{ing.id.slice(0, 8)}…</span>
                                    </p>
                                    <Paper className="mt-2 px-3.5 py-2.5 text-sm whitespace-pre-wrap">{text}</Paper>
                                </div>
                                <IconButton
                                    label="Dismiss"
                                    className="shrink-0"
                                    onClick={() => setDismissed(prev => new Set(prev).add(ing.id))}
                                >
                                    <X size={15} />
                                </IconButton>
                                <div className="flex gap-2 w-full">
                                    <Button size="sm" variant="outline" fullWidth onClick={() => routeTo(ing, '/loans/new')}>
                                        Loan
                                    </Button>
                                    <Button size="sm" variant="outline" fullWidth onClick={() => routeTo(ing, '/payments/new')}>
                                        Payment
                                    </Button>
                                    <Button size="sm" variant="amber" fullWidth onClick={() => routeTo(ing, '/entries/new')}>
                                        Entry
                                    </Button>
                                </div>
                            </Panel>
                        </div>
                    );
                })}
            </div>

            <Dialog open={openModal} onClose={closeModal} title="Book ingestion" width="max-w-sm">
                {ingestionLoading && (
                    <div className="flex justify-center py-6">
                        <Spinner size={24} />
                    </div>
                )}
                {!ingestionLoading && !selectedIngestion && (
                    <p className="text-sm text-silverdim py-2 text-center">
                        Ingestion {selectedId?.slice(0, 8)}… is no longer pending.
                    </p>
                )}
                {selectedIngestion && (() => {
                    const amt = ingestionAmount(selectedIngestion);
                    return (
                        <>
                            <Paper className="px-3.5 py-2.5 text-sm whitespace-pre-wrap">
                                {ingestionDisplayText(selectedIngestion) ?? '(no description)'}
                            </Paper>
                            <p className="flex items-center gap-3 mt-2 text-xs font-mono text-silverdim tnum">
                                <span>{amt != null ? money(amt) : '—'}</span>
                                <span>{ingestionDate(selectedIngestion) ?? '—'}</span>
                                <span>{selectedIngestion.id.slice(0, 8)}…</span>
                            </p>
                            <p className="text-sm text-silverdim mt-3">
                                Choose how to book this record.
                            </p>
                        </>
                    );
                })()}
                <div className="mt-5 flex gap-2">
                    <Button
                        variant="outline"
                        fullWidth
                        disabled={!selectedIngestion}
                        onClick={() => selectedIngestion && routeTo(selectedIngestion, '/loans/new')}
                    >
                        Loan
                    </Button>
                    <Button
                        variant="outline"
                        fullWidth
                        disabled={!selectedIngestion}
                        onClick={() => selectedIngestion && routeTo(selectedIngestion, '/payments/new')}
                    >
                        Payment
                    </Button>
                    <Button
                        variant="amber"
                        fullWidth
                        disabled={!selectedIngestion}
                        onClick={() => selectedIngestion && routeTo(selectedIngestion, '/entries/new')}
                    >
                        Entry
                    </Button>
                </div>
            </Dialog>
        </div>
    );
};

export default IngestPage;
