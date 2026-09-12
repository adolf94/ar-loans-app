import React, { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Button, Checkbox, IconButton, Input, Select } from '../ui';
import { Camera, Sparkles, UserPlus, ChevronDown, ChevronRight, Download, CheckCircle2 } from 'lucide-react';
import type { User, Loan, UserAccount } from '../../@types/types';
import { identifyTransaction, type IdentifiedTransaction } from '../../repositories/file';
import UserDialog from '../dialogs/UserDialog';
import IngestionPickerDialog from '../dialogs/IngestionPickerDialog';
import { getBankAccountByAccountId, createBankAccount } from '../../repositories/bankAccount';
import { resolveIngestionClientId } from '../../logic/ingestionMatch';
import { v7 as uuidv7 } from 'uuid';
import { useCreateLoan } from '../../repositories/loan';
import { useAccounts, type Account } from '../../repositories/account';
import { useUsers } from '../../repositories/user';
import { useGetInterestRules } from '../../repositories/interestRule';
import { useDateValidation } from '../../logic/dateValidation';
import {
    isFinanceEnabled,
    useIngestion,
    ingestionAmount,
    ingestionDate,
    ingestionDisplayText,
    ingestionLoanReference,
    type IngestionRecord
} from '../../repositories/finance';

export interface LoanFormProps {
    onSubmitted: (loan: Loan) => void;
    onCancel: () => void;
    currentLoansCount?: number;
    fixedGuarantorId?: string;
    /** Ingestion guid to prefill the form from (`/loans/new?ingestion_id=`). */
    ingestionId?: string;
    /** `inline` renders a standalone card; `dialog` relies on the wrapper's chrome. */
    variant?: 'dialog' | 'inline';
    submitLabel?: string;
}

interface LoanFormState {
    id: string;
    alternateId: string;
    clientId: string;
    principal: number;
    interestRate: number;
    termMonths: number;
    guarantorId: string;
    date: string;
    sourceAcct: string;
    fileId: string;
    gracePeriodDays: number;
    gracePeriodInterest: number;
    latePaymentPenalty: number;
    interestRuleId: string;
    interestBase: 'principal' | 'balance' | 'principalBalance';
    showAmortization: boolean;
    recurringGracePeriod: boolean;
    financeIngestionId?: string;
}

const LoanForm: React.FC<LoanFormProps> = ({
    onSubmitted,
    onCancel,
    fixedGuarantorId,
    ingestionId,
    variant = 'dialog',
    submitLabel = 'Issue Loan'
}) => {
    const makeInitial = (): LoanFormState => ({
        id: uuidv7(),
        alternateId: "",
        clientId: '',
        principal: 0,
        interestRate: 10,
        termMonths: 0,
        guarantorId: fixedGuarantorId || '',
        date: dayjs().format('YYYY-MM-DD'),
        sourceAcct: '',
        fileId: '',
        gracePeriodDays: 0,
        gracePeriodInterest: 0,
        latePaymentPenalty: 0,
        interestRuleId: window.webConfig.defaultLoanTemplate,
        interestBase: 'principal' as 'principal' | 'balance' | 'principalBalance',
        showAmortization: false,
        recurringGracePeriod: true,
        financeIngestionId: undefined
    });

    const [newLoan, setNewLoan] = useState<LoanFormState>(makeInitial);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [imgData, setImgData] = useState<IdentifiedTransaction | null>(null);
    const [found, setFound] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [imported, setImported] = useState<IngestionRecord | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [attempted, setAttempted] = useState(false);

    const createLoan = useCreateLoan();
    const { data: accounts = [] } = useAccounts();
    const { data: users = [] } = useUsers();
    const { data: rules = [] } = useGetInterestRules();
    const validateDate = useDateValidation();
    const assetAccounts = accounts.filter((a: Account) => a.section === 'Assets');
    const financeOn = isFinanceEnabled();

    type OtherUpdates = Partial<LoanFormState> | ((prev: LoanFormState) => Partial<LoanFormState>);

    const handleSelectUser = (selectedUserId: string, otherUpdates: OtherUpdates = {}) => {
        const selectedUser = users.find(u => u.id === selectedUserId);
        const updates: Partial<LoanFormState> = { clientId: selectedUserId };

        const selectDefaultId = selectedUser?.defaultInterestRuleId || window.webConfig.defaultLoanTemplate;
        const rule = rules.find(r => r.id === selectDefaultId);
        if (rule) {
            updates.interestRuleId = rule.id;
            updates.interestRate = rule.interestPerMonth;
            updates.termMonths = rule.defaultTerms;
            updates.gracePeriodDays = rule.gracePeriodDays;
            updates.gracePeriodInterest = rule.gracePeriodInterest;
            updates.latePaymentPenalty = rule.latePaymentPenalty;
            updates.interestBase = rule.interestBase;
            updates.recurringGracePeriod = rule.recurringGracePeriod ?? true;
        }

        if (typeof otherUpdates === 'function') {
            setNewLoan(prev => {
                const newValue = otherUpdates(prev);
                return { ...newValue, ...updates } as LoanFormState;
            });
        } else {
            setNewLoan(prev => ({ ...prev, ...updates, ...otherUpdates }));
        }
    };

    const { data: linkedIngestion } = useIngestion(ingestionId, financeOn);

    const resolveClientId = (record: IngestionRecord) => resolveIngestionClientId(record, users);

    const applyIngestion = async (record: IngestionRecord) => {
        setImported(record);
        const amount = ingestionAmount(record);
        const date = ingestionDate(record);
        const ref = ingestionLoanReference(record);
        const clientId = await resolveClientId(record);

        setNewLoan(prev => {
            const altId = ref
                ? `${ref.slice(-6)}-${(date ? dayjs(date) : dayjs()).format('DD')}-${prev.id.slice(-4)}`
                : prev.alternateId;
            const updates: Partial<LoanFormState> = {
                principal: amount ?? prev.principal,
                date: date ?? prev.date,
                alternateId: altId,
                financeIngestionId: record.id
            };
            if (clientId) {
                const selectedUser = users.find(u => u.id === clientId);
                const selectDefaultId = selectedUser?.defaultInterestRuleId || window.webConfig.defaultLoanTemplate;
                const rule = rules.find(r => r.id === selectDefaultId);
                updates.clientId = clientId;
                if (rule) {
                    updates.interestRuleId = rule.id;
                    updates.interestRate = rule.interestPerMonth;
                    updates.termMonths = rule.defaultTerms;
                    updates.gracePeriodDays = rule.gracePeriodDays;
                    updates.gracePeriodInterest = rule.gracePeriodInterest;
                    updates.latePaymentPenalty = rule.latePaymentPenalty;
                    updates.interestBase = rule.interestBase;
                    updates.recurringGracePeriod = rule.recurringGracePeriod ?? true;
                }
            }
            return { ...prev, ...updates };
        });
    };

    const appliedIngestionRef = useRef<string | null>(null);
    useEffect(() => {
        if (!linkedIngestion || appliedIngestionRef.current === linkedIngestion.id) return;
        appliedIngestionRef.current = linkedIngestion.id;
        void applyIngestion(linkedIngestion);
    }, [linkedIngestion]);

    const handleAdd = async () => {
        setAttempted(true);
        if (!(await validateDate(newLoan.date))) return;

        const loan: Loan = {
            id: newLoan.id,
            clientId: newLoan.clientId,
            principal: newLoan.principal,
            balance: newLoan.principal,
            interestRate: newLoan.interestRate,
            termMonths: newLoan.termMonths,
            alternateId: newLoan.alternateId,
            date: newLoan.date,
            status: 'Active',
            guarantorId: newLoan.guarantorId || undefined,
            sourceAcct: newLoan.sourceAcct,
            fileId: newLoan.fileId,
            gracePeriodDays: newLoan.gracePeriodDays,
            gracePeriodInterest: newLoan.gracePeriodInterest,
            latePaymentPenalty: newLoan.latePaymentPenalty,
            interestBase: newLoan.interestBase,
            showAmortization: newLoan.showAmortization,
            recurringGracePeriod: newLoan.recurringGracePeriod,
            financeIngestionId: newLoan.financeIngestionId,
            transactions: []
        };
        if (!found && !!imgData) {
            const userAcct: UserAccount = {
                name: imgData.recipientName,
                accountNumber: imgData.recipientAcct,
                bank: imgData.recipientBank,
                userId: newLoan.clientId
            };
            await createBankAccount(userAcct);
        }
        const created = await createLoan.mutateAsync(loan);
        setNewLoan(makeInitial());
        setImported(null);
        setShowAdvanced(false);
        setImgData(null);
        setFound(false);
        onSubmitted(created.loan!);
    };

    const handleAddUser = (user: User) => {
        setNewLoan(prev => ({ ...prev, clientId: user.id }));
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        try {
            const data = await identifyTransaction(file);
            if (data) {
                setImgData(data);

                const acct = await getBankAccountByAccountId(data.recipientAcct)
                    .catch(err => {
                        console.error("Error getting bank account:", err);
                        return null;
                    });

                setFound(acct != null);

                const recipient = await getBankAccountByAccountId(data.senderAcct)
                    .catch(err => {
                        console.error("Error getting bank account:", err);
                        return null;
                    });

                handleSelectUser(acct?.userId || '', (prev: LoanFormState) => {
                    return {
                        alternateId: `${data.reference.slice(-6)}-${dayjs(data.datetime).format("DD")}-${newLoan.id.slice(-4)}`,
                        principal: data.amount || prev.principal,
                        sourceAcct: recipient?.accountId || prev.sourceAcct,
                        fileId: data.fileId || '',
                        date: data.datetime ? dayjs(data.datetime).format('YYYY-MM-DD') : prev.date
                    };
                });
            }
        } catch (error) {
            console.error("Error identifying transaction:", error);
        } finally {
            setIsScanning(false);
            event.target.value = '';
        }
    };

    const isInline = variant === 'inline';

    const headerActions = (
        <div className="flex items-center gap-1.5">
            <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                id={`loan-scan-input-${variant}`}
                onChange={handleImageUpload}
            />
            <label
                htmlFor={`loan-scan-input-${variant}`}
                className={`inline-flex cursor-pointer ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}
            >
                <span className="p-2 border border-line rounded-md text-silver hover:text-amber hover:border-amberdeep transition-colors inline-flex" title={isScanning ? 'Scanning...' : 'Scan Receipt'}>
                    {isScanning ? <Sparkles size={16} className="animate-pulse" strokeWidth={1.7} /> : <Camera size={16} strokeWidth={1.7} />}
                </span>
            </label>
            {financeOn && (
                <IconButton label="Import from Ingestion" onClick={() => setPickerOpen(true)}>
                    <Download size={16} strokeWidth={1.7} />
                </IconButton>
            )}
        </div>
    );

    const body = (
        <div className="space-y-5">
            {imported && (
                <div className="border border-dashed border-linestrong rounded-md px-3.5 py-3 flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-good shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-good">Imported from ingestion</p>
                        <p className="text-xs text-silverdim mt-0.5">
                            {ingestionDisplayText(imported) ?? 'Notification'} · {imported.id}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex items-end gap-2">
                <div className="flex-1">
                    <Select
                        label="Client"
                        value={newLoan.clientId}
                        onChange={(e) => { handleSelectUser(e.target.value); }}
                        options={[{ value: '', label: 'Select a client', disabled: true }, ...users.map(u => ({ value: u.id, label: u.name }))]}
                    />
                    {newLoan.interestRuleId && (
                        <p className="mt-1.5 text-xs text-silverdim inline-flex items-center gap-1.5">
                            <Sparkles size={12} className="text-amber" /> Template: {rules.find(r => r.id === newLoan.interestRuleId)?.name}
                        </p>
                    )}
                </div>
                <UserDialog onAddUser={handleAddUser} imgData={imgData}>
                    <IconButton label="Add New Client" className="mb-0.5">
                        <UserPlus size={18} strokeWidth={1.7} />
                    </IconButton>
                </UserDialog>
            </div>

            <Input
                label="Date"
                type="date"
                value={newLoan.date}
                onChange={(e) => setNewLoan({ ...newLoan, date: e.target.value })}
            />
            <Input
                label="Principal Amount (P)"
                type="number"
                className="tnum text-lg"
                value={newLoan.principal}
                onChange={(e) => setNewLoan({ ...newLoan, principal: Number(e.target.value) })}
            />
            <Input
                label="Monthly Interest Rate (%)"
                type="number"
                className="tnum"
                value={newLoan.interestRate}
                onChange={(e) => setNewLoan({ ...newLoan, interestRate: Number(e.target.value) })}
            />
            <Checkbox
                label="Show Amortization Schedule"
                checked={newLoan.showAmortization}
                onChange={(e) => setNewLoan({ ...newLoan, showAmortization: e.target.checked })}
            />
            {newLoan.showAmortization && (
                <div className="border border-dashed border-linestrong rounded-md px-3.5 py-3 flex items-baseline justify-between gap-4">
                    <span className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim">Expected Monthly Payment</span>
                    <span className="font-mono font-bold text-amber tnum">
                        P {(() => {
                            const p = newLoan.principal;
                            const r = newLoan.interestRate / 100;
                            const n = newLoan.termMonths;
                            if (p <= 0 || n <= 0) return 0;

                            if (newLoan.interestBase === 'principal') {
                                return ((p + (p * r * n)) / n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            } else {
                                if (r === 0) return (p / n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                const emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                                return emi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                        })()}
                    </span>
                </div>
            )}

            <div className="border-t border-line pt-3">
                <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="inline-flex items-center gap-1 text-xs font-mono tracking-[0.16em] uppercase text-silverdim hover:text-amber transition-colors"
                >
                    {showAdvanced ? <ChevronDown size={14} strokeWidth={1.7} /> : <ChevronRight size={14} strokeWidth={1.7} />}
                    Advanced Settings
                </button>
                {showAdvanced && (
                    <div className="mt-4 border border-linestrong rounded-tray bg-tray/50 p-4 space-y-4">
                        {rules.length > 0 && (
                            <Select
                                label="Interest Template"
                                value={newLoan.interestRuleId}
                                onChange={(e) => {
                                    const selectedId = e.target.value;
                                    const updates: Partial<LoanFormState> = { interestRuleId: selectedId };
                                    if (selectedId) {
                                        const rule = rules.find(r => r.id === selectedId);
                                        if (rule) {
                                            updates.interestRate = rule.interestPerMonth;
                                            updates.termMonths = rule.defaultTerms;
                                            updates.gracePeriodDays = rule.gracePeriodDays;
                                            updates.gracePeriodInterest = rule.gracePeriodInterest;
                                            updates.latePaymentPenalty = rule.latePaymentPenalty;
                                            updates.interestBase = rule.interestBase;
                                            updates.recurringGracePeriod = rule.recurringGracePeriod ?? true;
                                        }
                                    }
                                    setNewLoan(prev => ({ ...prev, ...updates }));
                                }}
                                options={[
                                    { value: '', label: 'Custom / Manual' },
                                    ...rules.map((r) => ({ value: r.id, label: `${r.name} (${r.interestPerMonth}%)` }))
                                ]}
                            />
                        )}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Input
                                label="Grace Period (Days)"
                                type="number"
                                className="tnum"
                                value={newLoan.gracePeriodDays}
                                onChange={(e) => setNewLoan({ ...newLoan, gracePeriodDays: Number(e.target.value) })}
                            />
                            <Input
                                label="Grace Period Interest (%)"
                                type="number"
                                className="tnum"
                                value={newLoan.gracePeriodInterest}
                                onChange={(e) => setNewLoan({ ...newLoan, gracePeriodInterest: Number(e.target.value) })}
                            />
                            <Input
                                label="Late Payment Penalty (%)"
                                type="number"
                                className="tnum"
                                value={newLoan.latePaymentPenalty}
                                onChange={(e) => setNewLoan({ ...newLoan, latePaymentPenalty: Number(e.target.value) })}
                            />
                            <Input
                                label="Term (Months)"
                                type="number"
                                className="tnum"
                                value={newLoan.termMonths}
                                onChange={(e) => setNewLoan({ ...newLoan, termMonths: Number(e.target.value) })}
                            />
                        </div>
                        <Select
                            label="Interest Computed On"
                            value={newLoan.interestBase}
                            onChange={(e) => setNewLoan({ ...newLoan, interestBase: e.target.value as 'principal' | 'balance' | 'principalBalance' })}
                            options={[
                                { value: 'principal', label: 'Original Principal' },
                                { value: 'balance', label: 'Remaining Balance (Capped at Principal)' },
                                { value: 'principalBalance', label: 'Principal Balance (Principal first payout)' }
                            ]}
                        />
                        <Select
                            label="Grace Period Activation"
                            value={newLoan.recurringGracePeriod ? 'monthly' : 'start'}
                            onChange={(e) => setNewLoan({ ...newLoan, recurringGracePeriod: e.target.value === 'monthly' })}
                            options={[
                                { value: 'start', label: 'Start of Loan Only' },
                                { value: 'monthly', label: 'Monthly Basis (Every Month)' }
                            ]}
                        />
                    </div>
                )}
            </div>

            <Select
                label="Guarantor (Optional)"
                value={newLoan.guarantorId}
                onChange={(e) => setNewLoan({ ...newLoan, guarantorId: e.target.value })}
                disabled={!!fixedGuarantorId}
                options={[
                    { value: '', label: 'None' },
                    ...users.filter(u => ['Guarantor', "Admin"].indexOf(u.role) > -1).map(u => ({ value: u.id, label: u.name }))
                ]}
            />
            <Select
                label="Source Account (Asset)"
                value={newLoan.sourceAcct}
                onChange={(e) => setNewLoan({ ...newLoan, sourceAcct: e.target.value })}
                options={[{ value: '', label: 'Select account', disabled: true }, ...assetAccounts.map((a: Account) => ({ value: a.id, label: a.name }))]}
            />
            {attempted && !newLoan.sourceAcct && (
                <p className="text-xs text-bad">Choose a source account — the money has to come from somewhere.</p>
            )}
            {attempted && !newLoan.clientId && (
                <p className="text-xs text-bad">Pick a client — the loan needs a borrower before it can be issued.</p>
            )}
            {attempted && newLoan.clientId && newLoan.principal <= 0 && (
                <p className="text-xs text-bad">Principal is zero — enter the amount being released.</p>
            )}
        </div>
    );

    const actions = (
        <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button
                onClick={handleAdd}
                disabled={!newLoan.clientId || newLoan.principal <= 0 || !newLoan.sourceAcct || createLoan.isPending}
                loading={createLoan.isPending}
            >
                {createLoan.isPending ? 'Issuing...' : submitLabel}
            </Button>
        </div>
    );

    const picker = financeOn ? (
        <IngestionPickerDialog
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(record) => { void applyIngestion(record); setPickerOpen(false); }}
        />
    ) : null;

    if (isInline) {
        return (
            <div className="max-w-xl mx-auto">
                <div className="border border-linestrong rounded-tray bg-bay2/70 p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <h2 className="text-paper font-semibold text-xl tracking-tight">Issue New Loan</h2>
                        {headerActions}
                    </div>
                    {body}
                    {actions}
                </div>
                {picker}
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="text-paper font-semibold text-xl tracking-tight">Issue New Loan</h2>
                {headerActions}
            </div>
            {body}
            <div className="mt-6 pt-4 border-t border-line flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button
                    onClick={handleAdd}
                    disabled={!newLoan.clientId || newLoan.principal <= 0 || !newLoan.sourceAcct || createLoan.isPending}
                    loading={createLoan.isPending}
                >
                    {createLoan.isPending ? 'Issuing...' : submitLabel}
                </Button>
            </div>
            {picker}
        </>
    );
};

export default LoanForm;
