import React, { useMemo, useState } from 'react';
import { Plus, Link2 } from 'lucide-react';
import { useAccounts } from '../../repositories/account';
import { useLinkedBalances, isFinanceEnabled } from '../../repositories/finance';
import type { LinkedBalanceRow } from '../../repositories/finance';
import numeral from 'numeral';
import AccountDialog from './AccountDialog';
import { Button } from '../ui';

interface BalanceSheetTabProps {
    balanceSheet: {
        loanReceivables: number;
        interestReceivables: number;
        customAssets: number;
        totalAssets: number;
        customEquity: number;
        netRevenue: number;
        totalEquityLiability: number;
    };
}

// Income & Liabilities carry a negative ledger balance but are displayed as positive.
const AccountRow: React.FC<{
    account: { id: string; name: string; balance: number; section: string };
    linked?: LinkedBalanceRow;
    negate: boolean;
}> = ({ account, linked, negate }) => {
    const local = negate ? -account.balance : account.balance;
    const fin = linked?.isLinked && linked.financeBalance != null
        ? linked.financeBalance * (negate ? -1 : 1)
        : null;

    return (
        <div className="flex justify-between items-baseline">
            <div>
                <p className="text-sm text-paper">
                    {account.name}
                    {linked?.isLinked && (
                        <Link2 size={13} strokeWidth={1.7} className="inline-block ml-1.5 align-middle opacity-60" />
                    )}
                </p>
                {linked?.isLinked && (
                    <p className="text-xs text-silverdim">
                        finance: {linked.financeAccountName}
                    </p>
                )}
            </div>
            <div className="text-right">
                <p className="font-mono font-semibold text-paper tnum">P {numeral(local).format('0,0')}</p>
                {fin != null && (
                    <p className="text-xs font-mono text-silverdim tnum">
                        P {numeral(fin).format('0,0')}
                    </p>
                )}
            </div>
        </div>
    );
};

const BalanceSheetTab: React.FC<BalanceSheetTabProps> = () => {
    const { data: accounts = [] } = useAccounts();
    const { data: linked = [] } = useLinkedBalances(isFinanceEnabled());
    const [openDialog, setOpenDialog] = useState(false);

    const linkedById = useMemo(
        () => Object.fromEntries(linked.map(l => [l.loanAccountId, l])),
        [linked]);

    const totalAssets = accounts.filter(a => a.section === 'Assets').reduce((sum, a) => sum + a.balance, 0);
    const totalIncome = accounts.filter(a => a.section === 'Income').reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = accounts.filter(a => a.section === 'Liabilities').reduce((sum, a) => sum - a.balance, 0);
    const totalExpenses = accounts.filter(a => a.section === 'Expense').reduce((sum, a) => sum + a.balance, 0);

    return (
        <div className="py-2">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-paper font-semibold text-xl tracking-tight">Balance Sheet</h2>
                {window.webConfig?.allowAccountCreation && (
                    <Button
                        startIcon={<Plus size={18} strokeWidth={1.7} />}
                        onClick={() => setOpenDialog(true)}
                    >
                        Add Account
                    </Button>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <h3 className="text-paper font-semibold text-lg tracking-tight mb-3">Assets</h3>
                    <div className="space-y-2.5">
                        {accounts.filter(a => a.section === 'Assets').map(account => (
                            <AccountRow key={account.id} account={account} linked={linkedById[account.id]} negate={false} />
                        ))}
                        <div className="flex justify-between pt-2 border-t border-linestrong">
                            <p className="font-semibold text-paper">Total Assets</p>
                            <p className="font-mono font-bold text-amber tnum">P {numeral(totalAssets).format('0,0')}</p>
                        </div>
                    </div>
                </div>
                <div>
                    <h3 className="text-paper font-semibold text-lg tracking-tight mb-3">Equity &amp; Liabilities</h3>
                    <div className="space-y-2.5">
                        <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim mt-1">Income</p>
                        {accounts.filter(a => a.section === 'Income').map(account => (
                            <AccountRow key={account.id} account={account} linked={linkedById[account.id]} negate />
                        ))}

                        {accounts.filter(a => a.section === 'Expense').length > 0 && (
                            <>
                                <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim mt-1">Expenses</p>
                                {accounts.filter(a => a.section === 'Expense').map(account => (
                                    <AccountRow key={account.id} account={account} linked={linkedById[account.id]} negate={false} />
                                ))}
                            </>
                        )}

                        <div className="flex justify-between pt-2 pb-2 border-t border-linestrong">
                            <p className="font-semibold text-paper">Net Income</p>
                            <p className="font-mono font-bold text-good tnum">P {numeral(-totalIncome - totalExpenses).format('0,0')}</p>
                        </div>

                        <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim mt-1">Liabilities</p>
                        {accounts.filter(a => a.section === 'Liabilities').map(account => (
                            <AccountRow key={account.id} account={account} linked={linkedById[account.id]} negate />
                        ))}
                        <div className="flex justify-between pt-2 border-t border-linestrong">
                            <p className="font-semibold text-paper">Total Liabilities</p>
                            <p className="font-mono font-bold text-safelight tnum">P {numeral(totalLiabilities).format('0,0')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <AccountDialog open={openDialog} onClose={() => setOpenDialog(false)} />
        </div>
    );
};

export default BalanceSheetTab;
