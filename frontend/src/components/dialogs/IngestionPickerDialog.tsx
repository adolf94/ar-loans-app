import React from 'react';
import { Button, Dialog, Spinner } from '../ui';
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
        <Dialog open={open} onClose={onClose} title="Import from Ingestion" width="max-w-2xl">
            <div className="overflow-x-auto border border-linestrong rounded-md max-h-[380px] overflow-y-auto">
                <table className="w-full text-sm min-w-[640px]">
                    <thead className="sticky top-0 bg-bay2">
                        <tr className="text-left text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim border-b border-linestrong">
                            <th className="px-3 py-2.5 font-medium">Description</th>
                            <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                            <th className="px-3 py-2.5 font-medium">Date</th>
                            <th className="px-3 py-2.5 font-medium text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line/70">
                        {isLoading && (
                            <tr><td colSpan={4} className="py-8"><div className="flex justify-center"><Spinner size={20} /></div></td></tr>
                        )}
                        {!isLoading && ingestions.length === 0 && (
                            <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-silverdim">No pending ingestions</td></tr>
                        )}
                        {ingestions.map((ing) => {
                            const amt = ingestionAmount(ing);
                            const text = ingestionDisplayText(ing) ?? '(no description)';
                            return (
                                <tr key={ing.id} className="hover:bg-tray/50 transition-colors">
                                    <td className="px-3 py-2 max-w-[280px]">
                                        <p className="line-clamp-2 text-paper" title={text}>{text}</p>
                                        <p className="font-mono text-[11px] text-silverdim mt-0.5">{ing.id.slice(0, 8)}…</p>
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-bold text-paper tnum">{amt != null ? money(amt) : '—'}</td>
                                    <td className="px-3 py-2 font-mono text-silver tnum">{ingestionDate(ing) ?? '—'}</td>
                                    <td className="px-3 py-2 text-right">
                                        <Button size="sm" onClick={() => onSelect(ing)}>Use</Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Dialog>
    );
};

export default IngestionPickerDialog;
