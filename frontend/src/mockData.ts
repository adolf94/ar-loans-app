import type { User, Loan, Transaction, CustomAccount, GeneralLedgerEntry } from './@types/types';

export const mockUsers: User[] = [
    { id: '1', name: 'John Admin', email: 'admin@lendflow.com', role: 'Admin' },
    { id: '2', name: 'Maria Borrower', email: 'maria@example.com', role: 'Client' },
    { id: '3', name: 'James Guarantor', email: 'james@example.com', role: 'Guarantor' },
];

export const mockAccounts: CustomAccount[] = [
    { id: '1', name: 'Main Loan Fund', category: 'Asset', initialBalance: 100000 },
    { id: '2', name: 'Interest Revenue', category: 'Equity', initialBalance: 0 },
    { id: '3', name: 'Operating Expenses', category: 'Equity', initialBalance: 0 },
];

export const mockLoans: Loan[] = [
    {
        id: '101',
        alternateId: 'LN-101',
        clientId: '2',
        guarantorId: '3',
        principal: 5000,
        interestRate: 12,
        termMonths: 12,
        status: 'Active',
        date: '2026-01-15'
    },
    {
        id: '102',
        alternateId: 'LN-102',
        clientId: '2',
        principal: 2000,
        interestRate: 15,
        termMonths: 6,
        status: 'Paid',
        date: '2025-06-10'
    },
    {
        id: '103',
        alternateId: 'LN-103',
        clientId: '2',
        principal: 1000,
        interestRate: 10,
        termMonths: 3,
        status: 'Archived',
        date: '2024-12-01'
    },
    {
        id: '104',
        alternateId: 'LN-104',
        clientId: '3', // Some other client
        principal: 15000,
        interestRate: 8,
        termMonths: 24,
        status: 'Active',
        date: '2026-02-01'
    }
];

export const mockTransactions: Transaction[] = [
    { id: 't1', loanId: '101', amount: 5000, type: 'Disbursement', date: '2026-01-15', description: 'Initial disbursement' },
    { id: 't2', loanId: '101', amount: 450, type: 'Payment', date: '2026-02-15', description: 'Month 1 repayment' },
    { id: 't3', loanId: '102', amount: 2000, type: 'Disbursement', date: '2025-06-10', description: 'Small business loan' },
    { id: 't4', loanId: '102', amount: 2000, type: 'Payment', date: '2025-12-10', description: 'Final payoff' },
    { id: 't5', loanId: '103', amount: 1000, type: 'Disbursement', date: '2024-12-01', description: 'Emergency loan' },
    { id: 't6', loanId: '103', amount: 1000, type: 'Payment', date: '2025-03-01', description: 'Full repayment' },
];

export const mockLedger: GeneralLedgerEntry[] = [
    { id: 'l1', accountId: '1', amount: 5000, isDebit: true, date: '2026-01-15', description: 'Loan 101 Issuance', loanId: '101' },
    { id: 'l2', accountId: '1', amount: 450, isDebit: false, date: '2026-02-15', description: 'Loan 101 Payment', loanId: '101' },
    { id: 'l3', accountId: '3', amount: 1200, isDebit: true, date: '2026-02-10', description: 'Office Rent' },
];
