export type UserRole = 'Admin' | 'Client' | 'Guarantor';

export interface UserAccount {
    bank: string;
    accountNumber: string;
    name: string;
    qrData?: string;
    userId?: string;
    accountId?: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    mobileNumber?: string;
    role: UserRole;
    accounts?: UserAccount[];
    defaultInterestRuleId?: string;
}

export interface InterestRule {
    id: string;
    name: string;
    interestPerMonth: number;
    gracePeriodDays: number;
    gracePeriodInterest: number;
    latePaymentPenalty: number;
    defaultTerms: number;
    interestBase: 'principal' | 'balance' | 'principalBalance';
}

export type LoanStatus = 'Pending' | 'Active' | 'Paid' | 'Defaulted' | 'Archived';

export interface LoanLedger {
    ledgerId: string;
    altKey: string;
    type: string;
    amount: number;
    dateStart: string;
    endDate: string;
}

export interface Loan {
    id: string;
    alternateId: string;
    clientId: string;
    guarantorId?: string;
    principal: number;
    balance: number,
    interestRate: number; // Monthly Interest Rate (%)
    gracePeriodDays?: number;
    gracePeriodInterest?: number;
    latePaymentPenalty?: number;
    interestBase?: 'principal' | 'balance' | 'principalBalance';
    termMonths: number;
    status: LoanStatus;
    date: string;
    sourceAcct?: string;
    fileId?: string;
    transactions: LoanLedger[];
}

export type TransactionType = 'Disbursement' | 'Payment' | 'Interest';

export interface Transaction {
    id: string;
    loanId: string;
    amount: number;
    type: TransactionType;

    date: string;
    description: string;
}

export type AccountCategory = 'Asset' | 'Liability' | 'Equity';

export interface CustomAccount {
    id: string;
    name: string;
    category: AccountCategory;
    initialBalance: number;
}

export interface GeneralLedgerEntry {
    id: string;
    amount: number;
    debitId: string;
    creditId: string;
    date: string;
    description: string;
}

export interface PortfolioStats {
    totalPrincipal: number;
    totalInterestReceivable: number;
    totalRiskExposure: number;
    healthScore: number;
}

export interface Payment {

    id: string,
    loanId: string,
    amount: number,
    destinationAcctId: string,
    userId: string,
    date: string,
    description: string
} 
