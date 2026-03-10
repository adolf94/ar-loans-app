import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Box
} from '@mui/material';
import dayjs from 'dayjs';

interface AmortizationScheduleProps {
    principal: number;
    interestRate: number;
    termMonths: number;
    startDate: string;
    interestBase: 'principal' | 'balance' | 'principalBalance';
}

const AmortizationSchedule: React.FC<AmortizationScheduleProps> = ({
    principal,
    interestRate,
    termMonths,
    startDate,
    interestBase
}) => {
    const calculateSchedule = () => {
        const r = interestRate / 100;
        const n = termMonths;
        const p = principal;

        if (p <= 0 || n <= 0) return [];

        let emi = 0;
        if (interestBase === 'principal') {
            // Flat Rate
            emi = (p + (p * r * n)) / n;
        } else {
            // Reducing Balance (EMI)
            if (r === 0) emi = p / n;
            else emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        }

        const schedule = [];
        let remainingBalance = p;
        let currentDate = dayjs(startDate);

        for (let i = 1; i <= n; i++) {
            let interestCharge = 0;
            if (interestBase === 'principal') {
                interestCharge = p * r;
            } else {
                interestCharge = remainingBalance * r;
            }

            const principalPayment = emi - interestCharge;
            remainingBalance -= principalPayment;
            currentDate = currentDate.add(1, 'month');

            schedule.push({
                period: i,
                date: currentDate.format('MMM DD, YYYY'),
                payment: emi,
                principal: principalPayment,
                interest: interestCharge,
                balance: Math.max(0, remainingBalance)
            });
        }
        return schedule;
    };

    const schedule = calculateSchedule();

    if (schedule.length === 0) return null;

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom fontWeight={700} color="primary">
                Forthcoming Payments (Amortization Schedule)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>Date</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>Payment</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>Principal</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>Interest</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>Balance</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {schedule.map((row) => (
                            <TableRow key={row.period} hover>
                                <TableCell>{row.period}</TableCell>
                                <TableCell>{row.date}</TableCell>
                                <TableCell align="right">P {row.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell align="right">P {row.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell align="right">P {row.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>P {row.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default AmortizationSchedule;
