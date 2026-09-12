import React, { useEffect, useRef, useState } from 'react';
import { Button, IconButton, Input, Select } from '../ui';
import { Camera, Sparkles, Download, CheckCircle2 } from 'lucide-react';
import type { Payment } from '../../@types/types';
import { v7 as uuidv7 } from "uuid"
import { useAccounts, type Account } from '../../repositories/account';
import { identifyTransaction } from '../../repositories/file';
import { getBankAccountByAccountId } from '../../repositories/bankAccount';
import dayjs from 'dayjs';
import { useCreatePayment } from '../../repositories/payment';
import { useUsers } from '../../repositories/user';
import { useLoansFiltered } from '../../repositories/loan';
import { useDateValidation } from '../../logic/dateValidation';
import { resolveIngestionClientId, resolveIngestionDestinationAcct } from '../../logic/ingestionMatch';
import IngestionPickerDialog from '../dialogs/IngestionPickerDialog';
import {
    isFinanceEnabled,
    useIngestion,
    ingestionAmount,
    ingestionDate,
    ingestionNote,
    ingestionDisplayText,
    ingestionLoanReference,
    type IngestionRecord
} from '../../repositories/finance';

export interface PaymentFormProps {
    onSubmitted: (payment: Payment) => void;
    onCancel: () => void;
    initialLoanId?: string;
    initialUserId?: string;
    /** Ingestion guid to prefill the form from (`/payments/new?ingestion_id=`). */
    ingestionId?: string;
    /** `inline` renders a standalone card; `dialog` relies on the wrapper's chrome. */
    variant?: 'dialog' | 'inline';
    submitLabel?: string;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
    onSubmitted,
    onCancel,
    initialLoanId,
    initialUserId,
    ingestionId,
    variant = 'dialog',
    submitLabel = 'Record Payment'
}) => {
    const makeInitial = (): Payment => ({
        id: uuidv7(),
        loanId: initialLoanId || "",
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        destinationAcctId: "",
        description: "",
        userId: initialUserId || ""
    });

    const [newPayment, setNewPayment] = useState<Payment>(makeInitial);
    const [isScanning, setIsScanning] = useState(false);
    const [imported, setImported] = useState<IngestionRecord | null>(null);
    const [resolvedClientHint, setResolvedClientHint] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [attempted, setAttempted] = useState(false);

    const { data: activeLoans = [] } = useLoansFiltered('Active');
    const { data: users = [] } = useUsers();
    const { data: accounts = [] } = useAccounts();
    const createPayment = useCreatePayment();
    const validateDate = useDateValidation();
    const assetAccounts = accounts.filter((a: Account) => a.section === 'Assets');
    const financeOn = isFinanceEnabled();

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        try {
            const data = await identifyTransaction(file);
            if (data) {
                const acct = await getBankAccountByAccountId(data.recipientAcct)
                    .catch(err => {
                        console.error("Error getting bank account:", err);
                        return null;
                    });

                setNewPayment((prev: Payment) => ({
                    ...prev,
                    destinationAcctId: acct?.accountId || "",
                    amount: data.amount || prev.amount,
                    date: dayjs(data.datetime).format("YYYY-MM-DD") || prev.date,
                    fileId: data.fileId || ""
                }));

            }
        } catch (error) {
            console.error("Error identifying transaction:", error);
        } finally {
            setIsScanning(false);
            event.target.value = '';
        }
    };

    const { data: linkedIngestion } = useIngestion(ingestionId, financeOn);

    const applyIngestion = async (record: IngestionRecord) => {
        setImported(record);
        const amount = ingestionAmount(record);
        const date = ingestionDate(record);
        const note = ingestionNote(record);
        const ref = ingestionLoanReference(record);

        let loan = ref
            ? activeLoans.find(l => l.alternateId === ref || l.id === ref)
            : undefined;
        let clientId = '';
        if (!loan) {
            clientId = await resolveIngestionClientId(record, users);
            if (clientId) {
                const clientLoans = activeLoans.filter(l => l.clientId === clientId);
                if (clientLoans.length === 1) loan = clientLoans[0];
            }
        }
        setResolvedClientHint(!loan && clientId
            ? users.find(u => u.id === clientId)?.name || null
            : null);

        const destination = await resolveIngestionDestinationAcct(record);
        const destinationAcctId = assetAccounts.some(a => a.id === destination) ? destination : "";

        setNewPayment(prev => ({
            ...prev,
            amount: amount ?? prev.amount,
            date: date ?? prev.date,
            description: note ?? prev.description,
            loanId: loan?.id ?? prev.loanId,
            userId: loan ? loan.clientId : prev.userId,
            destinationAcctId: destinationAcctId || prev.destinationAcctId,
            financeIngestionId: record.id
        }));
    };

    const appliedIngestionRef = useRef<string | null>(null);
    useEffect(() => {
        if (!linkedIngestion || appliedIngestionRef.current === linkedIngestion.id) return;
        appliedIngestionRef.current = linkedIngestion.id;
        void applyIngestion(linkedIngestion);
    }, [linkedIngestion]);

    const handleAdd = async () => {
        setAttempted(true);
        if (!(await validateDate(newPayment.date))) {
            return;
        }

        const payment: Payment = {
            ...newPayment,
        };
        const data = await createPayment.mutateAsync(payment)
        onSubmitted(data as unknown as Payment);
    };

    const isInline = variant === 'inline';

    const headerActions = (
        <div className="flex items-center gap-1.5">
            <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                id={`payment-scan-input-${variant}`}
                onChange={handleImageUpload}
            />
            <label
                htmlFor={`payment-scan-input-${variant}`}
                title={isScanning ? 'Scanning...' : 'Scan Receipt'}
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

    const loanOptions = activeLoans.filter(l => l.status === 'Active').map(l => ({
        value: l.id,
        label: `L${l.alternateId} (${users.find(u => u.id === l.clientId)?.name} / B: ${l.balance})`
    }));

    const body = (
        <div className="space-y-4">
            {imported && (
                <div className="border border-dashed border-linestrong rounded-md px-3.5 py-3 flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-good shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-good">Imported from ingestion</p>
                        <p className="text-xs text-silverdim mt-0.5">
                            {ingestionDisplayText(imported) ?? 'Notification'} · {imported.id}
                        </p>
                        {resolvedClientHint && (
                            <p className="text-xs text-silverdim mt-1">
                                Client: {resolvedClientHint} — select their loan to continue.
                            </p>
                        )}
                    </div>
                </div>
            )}
            <Select
                label="Active Loan"
                value={newPayment.loanId}
                onChange={(e) => setNewPayment({ ...newPayment, loanId: e.target.value, userId: activeLoans.find(f => f.id == e.target.value)?.clientId ?? "" })}
                options={[{ value: '', label: 'Select a loan', disabled: true }, ...loanOptions]}
            />
            {attempted && !newPayment.loanId && (
                <p className="text-xs text-bad">Pick an active loan — a payment must land on a line.</p>
            )}
            <Input
                label="Payment Amount (P)"
                type="number"
                className="tnum text-lg"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: Number(e.target.value) })}
                error={attempted && newPayment.amount == 0 ? 'Amount is zero — enter the figure that was received.' : ''}
            />
            <Input
                label="Date"
                type="date"
                value={newPayment.date}
                onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
            />
            <Select
                label="Destination Account (Asset)"
                value={newPayment.destinationAcctId}
                onChange={(e) => setNewPayment({ ...newPayment, destinationAcctId: e.target.value })}
                options={[{ value: '', label: 'Select account', disabled: true }, ...assetAccounts.map((a: Account) => ({ value: a.id, label: a.name }))]}
            />
        </div>
    );

    const submitDisabled = !newPayment.loanId || newPayment.amount == 0 || createPayment.isPending;

    const picker = financeOn ? (
        <IngestionPickerDialog
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(record) => { void applyIngestion(record); setPickerOpen(false); }}
        />
    ) : null;

    const footer = (
        <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button
                onClick={handleAdd}
                disabled={submitDisabled}
                loading={createPayment.isPending}
            >
                {createPayment.isPending ? 'Recording...' : submitLabel}
            </Button>
        </div>
    );

    if (isInline) {
        return (
            <div className="max-w-xl mx-auto">
                <div className="border border-linestrong rounded-tray bg-bay2/70 p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <h2 className="text-paper font-semibold text-xl tracking-tight">Record Loan Payment</h2>
                        {headerActions}
                    </div>
                    {body}
                    {footer}
                </div>
                {picker}
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="text-paper font-semibold text-xl tracking-tight">Record Loan Payment</h2>
                {headerActions}
            </div>
            {body}
            <div className="mt-6 pt-4 border-t border-line flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button
                    onClick={handleAdd}
                    disabled={submitDisabled}
                    loading={createPayment.isPending}
                >
                    {createPayment.isPending ? 'Recording...' : submitLabel}
                </Button>
            </div>
            {picker}
        </>
    );
};

export default PaymentForm;
