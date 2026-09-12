import React from 'react';
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
            emi = (p + (p * r * n)) / n;
        } else {
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
        <div className="mt-2">
            <p className="text-[11px] font-mono tracking-[0.16em] uppercase opacity-60 mb-1.5">Forthcoming payments (amortization schedule)</p>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-current/25 rounded-md">
                <table className="w-full text-sm min-w-[640px]">
                    <thead>
                        <tr className="text-left text-[11px] font-mono uppercase tracking-[0.16em] opacity-60 border-b border-current/30">
                            <th className="py-2 px-3 font-medium">#</th>
                            <th className="py-2 px-3 font-medium">Date</th>
                            <th className="py-2 px-3 text-right font-medium">Payment</th>
                            <th className="py-2 px-3 text-right font-medium">Principal</th>
                            <th className="py-2 px-3 text-right font-medium">Interest</th>
                            <th className="py-2 px-3 text-right font-medium">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-current/15">
                        {schedule.map((row) => (
                            <tr key={row.period}>
                                <td className="py-2 px-3 font-mono text-xs opacity-70">{row.period}</td>
                                <td className="py-2 px-3 font-mono text-xs whitespace-nowrap opacity-70">{row.date}</td>
                                <td className="py-2 px-3 text-right font-mono tnum whitespace-nowrap">P {row.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="py-2 px-3 text-right font-mono tnum whitespace-nowrap">P {row.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="py-2 px-3 text-right font-mono tnum whitespace-nowrap">P {row.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="py-2 px-3 text-right font-mono tnum font-bold whitespace-nowrap">P {row.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AmortizationSchedule;
