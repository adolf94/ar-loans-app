import React from 'react';
import {
    Grid,
    Typography,
    Stack,
    Box
} from '@mui/material';
import { useAccounts } from '../../repositories/account';
import numeral from 'numeral';

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

const BalanceSheetTab: React.FC<BalanceSheetTabProps> = () => {

    const { data: accounts = [] } = useAccounts();

    const totalAssets = accounts.filter(a => a.section === 'Assets').reduce((sum, a) => sum + a.balance, 0);
    const totalIncome = accounts.filter(a => a.section === 'Income').reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = accounts.filter(a => a.section === 'Liabilities').reduce((sum, a) => sum - a.balance, 0);

    return (

        <Grid container spacing={4} sx={{ p: 2 }}>
            <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom fontWeight={700}>Assets</Typography>
                <Stack spacing={2}>
                    {accounts.filter(a => a.section === 'Assets').map(account => (
                        <Box key={account.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>{account.name}</Typography>
                            <Typography fontWeight={600}>P {account.balance.toLocaleString()}</Typography>
                        </Box>
                    ))}


                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                        <Typography fontWeight={700}>Total Assets</Typography>
                        <Typography fontWeight={700} color="primary.main">P {numeral(totalAssets).format('0,0')}</Typography>
                    </Box>
                </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom fontWeight={700}>Income & Liabilities</Typography>
                <Stack spacing={2}>
                    {accounts.filter(a => a.section === 'Income').map(account => (
                        <Box key={account.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>{account.name}</Typography>
                            <Typography fontWeight={600}>P {numeral(-account.balance).format('0,0')}</Typography>
                        </Box>
                    ))}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, pb: 2, borderTop: 1, borderColor: 'divider' }}>
                        <Typography fontWeight={700}>Total Income</Typography>
                        <Typography fontWeight={700} color="secondary.main">P {numeral(-totalIncome).format('0,0')}</Typography>
                    </Box>

                    {accounts.filter(a => a.section === 'Liabilities').map(account => (
                        <Box key={account.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography>{account.name}</Typography>
                            <Typography fontWeight={600}>P {numeral(-account.balance).format('0,0')}</Typography>
                        </Box>
                    ))}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                        <Typography fontWeight={700}>Total Liabilities</Typography>
                        <Typography fontWeight={700} color="secondary.main">P {numeral(totalLiabilities).format('0,0')}</Typography>
                    </Box>
                </Stack>
            </Grid>
        </Grid>
    );
};

export default BalanceSheetTab;
