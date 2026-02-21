import type { Loan, Transaction, GeneralLedgerEntry, CustomAccount } from '../@types/types';

/**
 * Calculates the total principal remaining for a loan.
 */
export const calculateRemainingPrincipal = (loan: Loan, transactions: Transaction[]): number => {
    const loanTransactions = transactions.filter(t => t.loanId === loan.id);
    const disbursements = loanTransactions
        .filter(t => t.type === 'Disbursement')
        .reduce((sum, t) => sum + t.amount, 0);
    const principalPayments = loanTransactions
        .filter(t => t.type === 'Payment')
        .reduce((sum, t) => sum + t.amount, 0);

    return disbursements - principalPayments;
};

/**
 * Estimates projected interest revenue for a loan.
 * Formula: Simple Interest = P * r * t
 */
export const estimateProjectedInterest = (loan: Loan): number => {
    const monthlyRate = loan.interestRate / 100;
    return loan.principal * monthlyRate * loan.termMonths;
};

/**
 * Aggregates the balance sheet values.
 */
export const calculateBalanceSheet = (
    loans: Loan[],
    transactions: Transaction[],
    customAccounts: CustomAccount[],
    ledgerEntries: GeneralLedgerEntry[]
) => {
    // 1. Calculate Loan Receivables (Remaining Principal)
    const loanReceivables = loans.reduce((sum, loan) => {
        return sum + calculateRemainingPrincipal(loan, transactions);
    }, 0);

    // 2. Calculate Interest Receivables (Simplified: Projected - Paid)
    const totalPaidInterest = transactions
        .filter(t => t.type === 'Interest')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalProjectedInterest = loans.reduce((sum, loan) => {
        return sum + estimateProjectedInterest(loan);
    }, 0);

    const interestReceivables = Math.max(0, totalProjectedInterest - totalPaidInterest);

    // 3. Aggregate Custom Accounts
    const accountBalances = customAccounts.reduce((acc, account) => {
        const entries = ledgerEntries.filter(e => e.accountId === account.id);
        const balance = entries.reduce((sum, entry) => {
            // Asset: Debit increases, Credit decreases
            // Liability/Equity: Credit increases, Debit decreases
            if (account.category === 'Asset') {
                return sum + (entry.isDebit ? entry.amount : -entry.amount);
            } else {
                return sum + (entry.isDebit ? -entry.amount : entry.amount);
            }
        }, account.initialBalance);

        acc[account.category] = (acc[account.category] || 0) + balance;
        return acc;
    }, {} as Record<string, number>);

    const customAssets = accountBalances['Asset'] || 0;
    const customLiabilities = accountBalances['Liability'] || 0;
    const customEquity = accountBalances['Equity'] || 0;

    // 4. Net Revenue (Retained Earnings)
    // Revenue = Paid Interest
    // Expenses = (Not explicitly tracked yet, but could be added)
    const netRevenue = totalPaidInterest;

    const totalAssets = loanReceivables + interestReceivables + customAssets;
    const totalEquityLiability = customLiabilities + customEquity + netRevenue;

    return {
        loanReceivables,
        interestReceivables,
        customAssets,
        customLiabilities,
        customEquity,
        netRevenue,
        totalAssets,
        totalEquityLiability
    };
};

/**
 * Calculates Guarantor Exposure.
 */
export const calculateGuarantorExposure = (guarantorId: string, loans: Loan[], transactions: Transaction[]) => {
    const guaranteedLoans = loans.filter(l => l.guarantorId === guarantorId);

    const totalOriginalRisk = guaranteedLoans.reduce((sum, l) => sum + l.principal, 0);
    const currentExposure = guaranteedLoans.reduce((sum, loan) => {
        return sum + calculateRemainingPrincipal(loan, transactions);
    }, 0);

    const clearedAgreements = guaranteedLoans.filter(l => l.status === 'Paid').length;

    return {
        totalOriginalRisk,
        currentExposure,
        clearedAgreements,
        riskExposureRate: totalOriginalRisk > 0 ? (currentExposure / totalOriginalRisk) * 100 : 0
    };
};
