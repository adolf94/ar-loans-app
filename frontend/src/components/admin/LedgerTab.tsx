import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useEntries, type Entry } from '../../repositories/entry';
import { useAccounts } from '../../repositories/account';
import dayjs from 'dayjs';
import ImageViewerDialog from '../dialogs/ImageViewerDialog';
import { Spinner, Skeleton, Panel } from '../ui';

interface LedgerTabProps {
    ledger?: any[]; // Keep for backward compatibility but not used
}

const PAGE_SIZE = 30;
const LOAD_MORE_SIZE = 20;

const toneClass = (section?: string, positiveIsGood?: boolean) => {
    const isGood = ["Asset", "Income"].indexOf(section ?? '') > -1 === positiveIsGood;
    if (!section) return 'text-silver';
    return isGood ? 'text-good' : 'text-bad';
};

const LedgerRow = (props: { entry: Entry }) => {
    let entry = props.entry;
    const { data: accounts = [] } = useAccounts();

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

    const creditClass = credit.name ? toneClass(credit.section, true) : 'text-silver';
    const debitClass = debit.name ? toneClass(debit.section, false) : 'text-silver';

    return (
        <tr className="hover:bg-tray/50 transition-colors">
            <td className="px-4 py-3 font-mono text-silverdim whitespace-nowrap">{dayjs(entry.date).format("MMM DD")}</td>
            <td className="px-4 py-3 text-paper">
                <span className="inline-flex items-center gap-2">
                    {entry.description}
                    {hasFile && (
                        <ImageViewerDialog fileId={entry.fileId}>
                            <button
                                className="p-1 border border-line rounded-md text-silver hover:text-amber hover:border-amberdeep transition-colors opacity-70 hover:opacity-100"
                                title="View screenshot"
                            >
                                <ImageIcon size={14} strokeWidth={1.7} />
                            </button>
                        </ImageViewerDialog>
                    )}
                </span>
            </td>
            <td className={`px-4 py-3 font-semibold ${creditClass}`}>{credit.name}</td>
            <td className={`px-4 py-3 font-semibold ${debitClass}`}>{debit.name}</td>
            <td className="px-4 py-3 text-right font-mono font-bold text-paper tnum whitespace-nowrap">P {entry.amount.toLocaleString()}</td>
        </tr>
    );
};


const LedgerTab: React.FC<LedgerTabProps> = () => {
    const { data: items = [], isLoading: isLoadingEntries } = useEntries();
    const { data: accounts = [], isLoading: isLoadingAccounts } = useAccounts();
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
        <div ref={containerRef} className="max-h-[calc(100vh-300px)] overflow-x-auto">
            <Panel pad={false} className="min-w-[640px] overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim border-b border-linestrong">
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Description</th>
                            <th className="px-4 py-3 font-medium">Credit Account</th>
                            <th className="px-4 py-3 font-medium">Debit Account</th>
                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line/70">
                        {isLoading ? (
                            [...Array(10)].map((_, i) => (
                                <tr key={i}>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                                </tr>
                            ))
                        ) : visibleEntries.length > 0 ? (
                            <>
                                {visibleEntries.map((entry) => <LedgerRow entry={entry} key={entry.id} />)}
                                {hasMore && (
                                    <tr ref={sentinelRef}>
                                        <td colSpan={5} className="px-4 py-3 text-center border-none">
                                            <div className="flex items-center justify-center gap-2">
                                                <Spinner size={16} />
                                                <span className="text-xs text-silverdim">
                                                    Showing {visibleCount} of {entries.length} entries
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ) : (
                            <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-sm text-silverdim">
                                    No ledger entries found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Panel>
        </div>
    );
};

export default LedgerTab;
