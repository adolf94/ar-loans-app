import React, { useMemo, useState } from 'react';
import {
    Grid,
    Typography,
    Stack,
    Box,
    Button
} from '@mui/material';
import { Plus, Link2 } from 'lucide-react';
import { useAccounts } from '../../repositories/account';
import { useLinkedBalances, isFinanceEnabled } from '../../repositories/finance';
import type { LinkedBalanceRow } from '../../repositories/finance';
import numeral from 'numeral';
import AccountDialog from './AccountDialog';

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Box>
                <Typography>
                    {account.name}
                    {linked?.isLinked && (
                        <Link2 size={13} style={{ marginLeft: 6, verticalAlign: 'middle', opacity: 0.6 }} />
                    )}
                </Typography>
                {linked?.isLinked && (
                    <Typography variant="caption" color="text.secondary">
                        finance: {linked.financeAccountName}
                    </Typography>
                )}
            </Box>
            <Box sx={{ textAlign: 'right' }}>
                <Typography fontWeight={600}>P {numeral(local).format('0,0')}</Typography>
                {fin != null && (
                    <Typography variant="caption" color="text.secondary">
                        P {numeral(fin).format('0,0')}
                    </Typography>
                )}
            </Box>
        </Box>
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
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" fontWeight={700}>Balance Sheet</Typography>
                {window.webConfig?.allowAccountCreation && (
                    <Button
                        variant="contained"
                        startIcon={<Plus size={18} />}
                        onClick={() => setOpenDialog(true)}
                    >
                        Add Account
                    </Button>
                )}
            </Box>

            <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="h6" gutterBottom fontWeight={700}>Assets</Typography>
                    <Stack spacing={2}>
                        {accounts.filter(a => a.section === 'Assets').map(account => (
                            <AccountRow key={account.id} account={account} linked={linkedById[account.id]} negate={false} />
                        ))}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                            <Typography fontWeight={700}>Total Assets</Typography>
                            <Typography fontWeight={700} color="primary.main">P {numeral(totalAssets).format('0,0')}</Typography>
                        </Box>
                    </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="h6" gutterBottom fontWeight={700}>Equity & Liabilities</Typography>
                    <Stack spacing={2}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Income</Typography>
                        {accounts.filter(a => a.section === 'Income').map(account => (
                            <AccountRow key={account.id} account={account} linked={linkedById[account.id]} negate />
                        ))}

                        {accounts.filter(a => a.section === 'Expense').length > 0 && (
                            <>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Expenses</Typography>
                                {accounts.filter(a => a.section === 'Expense').map(account => (
                                    <AccountRow key={account.id} account={account} linked={linkedById[account.id]} negate={false} />
                                ))}
                            </>
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, pb: 2, borderTop: 1, borderColor: 'divider' }}>
                            <Typography fontWeight={700}>Net Income</Typography>
                            <Typography fontWeight={700} color="success.main">P {numeral(-totalIncome - totalExpenses).format('0,0')}</Typography>
                        </Box>

                        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Liabilities</Typography>
                        {accounts.filter(a => a.section === 'Liabilities').map(account => (
                            <AccountRow key={account.id} account={account} linked={linkedById[account.id]} negate />
                        ))}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                            <Typography fontWeight={700}>Total Liabilities</Typography>
                            <Typography fontWeight={700} color="secondary.main">P {numeral(totalLiabilities).format('0,0')}</Typography>
                        </Box>
                    </Stack>
                </Grid>
            </Grid>

            <AccountDialog open={openDialog} onClose={() => setOpenDialog(false)} />
        </Box>
    );
};

export default BalanceSheetTab;
