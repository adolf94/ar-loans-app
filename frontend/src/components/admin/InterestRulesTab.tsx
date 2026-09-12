import React, { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import {
    useGetInterestRules,
    useCreateInterestRule,
    useUpdateInterestRule,
    useDeleteInterestRule
} from '../../repositories/interestRule';
import type { InterestRule } from '../../@types/types';
import { Button, IconButton, Input, Select, Dialog, Panel, SectionTitle, Skeleton } from '../ui';

const InterestRulesTab: React.FC = () => {
    const { data: rules = [], isLoading } = useGetInterestRules();
    const createRule = useCreateInterestRule();
    const updateRule = useUpdateInterestRule();
    const deleteRule = useDeleteInterestRule();

    const [openDialog, setOpenDialog] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<InterestRule>>({});

    const handleOpenDialog = (rule?: InterestRule) => {
        if (rule) {
            setEditingRule({ ...rule });
        } else {
            setEditingRule({
                name: '',
                interestPerMonth: 10,
                gracePeriodDays: 0,
                gracePeriodInterest: 0,
                latePaymentPenalty: 0,
                defaultTerms: 12,
                interestBase: 'principal' as const,
                recurringGracePeriod: true
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingRule({});
    };

    const handleSave = async () => {
        if (editingRule.id) {
            await updateRule.mutateAsync(editingRule as InterestRule);
        } else {
            await createRule.mutateAsync(editingRule);
        }
        handleCloseDialog();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this rule?")) {
            await deleteRule.mutateAsync(id);
        }
    };

    if (isLoading) return <div className="py-2 space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></div>;

    return (
        <div>
            <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
                <SectionTitle>Interest Rules (Templates)</SectionTitle>
                <Button
                    startIcon={<Plus size={18} strokeWidth={1.7} />}
                    onClick={() => handleOpenDialog()}
                >
                    Add Rule
                </Button>
            </div>

            <Panel pad={false} className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                    <thead>
                        <tr className="text-left text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim border-b border-linestrong">
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium text-right">Interest / Mo</th>
                            <th className="px-4 py-3 font-medium text-right">Grace Period</th>
                            <th className="px-4 py-3 font-medium text-right">Grace Period Int.</th>
                            <th className="px-4 py-3 font-medium text-right">Late Penalty</th>
                            <th className="px-4 py-3 font-medium text-right">Default Term</th>
                            <th className="px-4 py-3 font-medium">Interest Base</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line/70">
                        {rules.map((r) => (
                            <tr key={r.id} className="hover:bg-tray/50 transition-colors">
                                <td className="px-4 py-3 text-paper font-semibold">{r.name}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-paper tnum">{r.interestPerMonth}%</td>
                                <td className="px-4 py-3 text-right font-mono text-silver tnum">{r.gracePeriodDays} days</td>
                                <td className="px-4 py-3 text-right font-mono text-silver tnum">{r.gracePeriodInterest}%</td>
                                <td className="px-4 py-3 text-right font-mono text-silver tnum">{r.latePaymentPenalty}%</td>
                                <td className="px-4 py-3 text-right font-mono text-silver tnum">{r.defaultTerms} months</td>
                                <td className="px-4 py-3 text-silver">
                                    {r.interestBase === 'balance' ? 'Remaining Balance' :
                                        r.interestBase === 'principalBalance' ? 'Principal + Balance Avg' :
                                            'Original Principal'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1">
                                        <IconButton label="Edit rule" onClick={() => handleOpenDialog(r)}>
                                            <Edit2 size={16} strokeWidth={1.7} />
                                        </IconButton>
                                        <IconButton label="Delete rule" onClick={() => handleDelete(r.id)}>
                                            <Trash2 size={16} strokeWidth={1.7} className="hover:text-bad" />
                                        </IconButton>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {rules.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-3 text-center text-sm text-silverdim">No rules defined</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {rules.length === 0 && (
                    <div className="border border-dashed border-linestrong rounded-tray m-4 p-6 text-center text-sm text-silverdim">
                        No rules yet — add one to set how interest and penalties are computed.
                    </div>
                )}
            </Panel>

            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                title={editingRule.id ? 'Edit Rule' : 'Add Rule'}
                width="max-w-xl"
                actions={
                    <>
                        <Button variant="ghost" onClick={handleCloseDialog}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!editingRule.name}>
                            Save
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Input
                        label="Rule Name"
                        value={editingRule.name || ''}
                        onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    />
                    <Input
                        label="Monthly Interest Rate (%)"
                        type="number"
                        value={editingRule.interestPerMonth ?? ''}
                        onChange={(e) => setEditingRule({ ...editingRule, interestPerMonth: Number(e.target.value) })}
                    />
                    <Input
                        label="Grace Period (Days)"
                        type="number"
                        value={editingRule.gracePeriodDays ?? ''}
                        onChange={(e) => setEditingRule({ ...editingRule, gracePeriodDays: Number(e.target.value) })}
                    />
                    <Input
                        label="Grace Period Interest (%)"
                        type="number"
                        value={editingRule.gracePeriodInterest ?? ''}
                        onChange={(e) => setEditingRule({ ...editingRule, gracePeriodInterest: Number(e.target.value) })}
                    />
                    <Input
                        label="Late Payment Penalty (%)"
                        type="number"
                        value={editingRule.latePaymentPenalty ?? ''}
                        onChange={(e) => setEditingRule({ ...editingRule, latePaymentPenalty: Number(e.target.value) })}
                    />
                    <Input
                        label="Default Terms (Months)"
                        type="number"
                        value={editingRule.defaultTerms ?? ''}
                        onChange={(e) => setEditingRule({ ...editingRule, defaultTerms: Number(e.target.value) })}
                    />
                    <Select
                        label="Interest Computed On"
                        value={editingRule.interestBase || 'principal'}
                        onChange={(e) => setEditingRule({ ...editingRule, interestBase: e.target.value as 'principal' | 'balance' | 'principalBalance' })}
                        options={[
                            { value: 'principal', label: 'Original Principal' },
                            { value: 'balance', label: 'Remaining Balance (Capped at Principal)' },
                            { value: 'principalBalance', label: 'Principal Balance (Principal first payout)' }
                        ]}
                    />
                    <Select
                        label="Grace Period Activation"
                        value={editingRule.recurringGracePeriod ? 'monthly' : 'start'}
                        onChange={(e) => setEditingRule({ ...editingRule, recurringGracePeriod: e.target.value === 'monthly' })}
                        options={[
                            { value: 'start', label: 'Start of Loan Only' },
                            { value: 'monthly', label: 'Monthly Basis (Every Month)' }
                        ]}
                    />
                </div>
            </Dialog>
        </div>
    );
};

export default InterestRulesTab;
