import React, { useEffect, useRef, useState } from 'react';
import {
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack,
    Box,
    IconButton,
    Tooltip,
    Typography,
    Alert,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import { Camera, Sparkles, Download } from 'lucide-react';
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

    // Fetch only active loans for payment
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
                //get user By accountId
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
            // Reset input
            event.target.value = '';
        }
    };

    // ---- Ingestion prefill ----
    const { data: linkedIngestion } = useIngestion(ingestionId, financeOn);

    const applyIngestion = async (record: IngestionRecord) => {
        setImported(record);
        const amount = ingestionAmount(record);
        const date = ingestionDate(record);
        const note = ingestionNote(record);
        const ref = ingestionLoanReference(record);

        // Direct loan-reference match first, then client resolution.
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linkedIngestion]);

    const handleAdd = async () => {
        if (!(await validateDate(newPayment.date))) {
            return;
        }

        const payment: Payment = {
            ...newPayment,
        };
        const data = await createPayment.mutateAsync(payment)
        onSubmitted(data);
    };

    const isInline = variant === 'inline';

    const headerActions = (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
            <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                id={`payment-scan-input-${variant}`}
                onChange={handleImageUpload}
            />
            <label htmlFor={`payment-scan-input-${variant}`}>
                <Tooltip title={isScanning ? 'Scanning...' : 'Scan Receipt'}>
                    <IconButton
                        component="span"
                        size="small"
                        disabled={isScanning}
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                    >
                        {isScanning ? <Sparkles className="animate-pulse" size={16} /> : <Camera size={16} />}
                    </IconButton>
                </Tooltip>
            </label>
            {financeOn && (
                <Tooltip title="Import from Ingestion">
                    <IconButton
                        size="small"
                        onClick={() => setPickerOpen(true)}
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                    >
                        <Download size={16} />
                    </IconButton>
                </Tooltip>
            )}
        </Box>
    );

    const body = (
        <Stack spacing={2} sx={{ mt: isInline ? 0 : 1 }}>
            {imported && (
                <Alert severity="success" variant="outlined">
                    <Typography variant="body2" fontWeight={600}>Imported from ingestion</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {ingestionDisplayText(imported) ?? 'Notification'} · {imported.id}
                    </Typography>
                    {resolvedClientHint && (
                        <Typography variant="caption" color="text.secondary" display="block">
                            Client: {resolvedClientHint} — select their loan to continue.
                        </Typography>
                    )}
                </Alert>
            )}
            <FormControl fullWidth>
                <InputLabel>Active Loan</InputLabel>
                <Select
                    value={newPayment.loanId}
                    label="Active Loan"
                    onChange={(e) => setNewPayment({ ...newPayment, loanId: e.target.value, userId: activeLoans.find(f => f.id == e.target.value)?.clientId ?? "" })}
                >
                    {activeLoans.filter(l => l.status === 'Active').map(l => (
                        <MenuItem key={l.id} value={l.id}>
                            L{l.alternateId} ({users.find(u => u.id === l.clientId)?.name} / B: {l.balance})
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <TextField
                label="Payment Amount"
                type="number"
                fullWidth
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: Number(e.target.value) })}
            />
            <TextField
                label="Date"
                type="date"
                fullWidth
                value={newPayment.date}
                onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControl fullWidth>
                <InputLabel>Destination Account (Asset)</InputLabel>
                <Select
                    value={newPayment.destinationAcctId}
                    label="Source Account (Asset)"
                    onChange={(e) => setNewPayment({ ...newPayment, destinationAcctId: e.target.value })}
                >
                    {assetAccounts.map((a: Account) => (
                        <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Stack>
    );

    const submitDisabled = !newPayment.loanId || newPayment.amount == 0 || createPayment.isPending;

    const picker = financeOn ? (
        <IngestionPickerDialog
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(record) => { void applyIngestion(record); setPickerOpen(false); }}
        />
    ) : null;

    if (isInline) {
        return (
            <Box sx={{ maxWidth: 520, mx: 'auto' }}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="h6" fontWeight={700}>Record Loan Payment</Typography>
                    {headerActions}
                </Stack>
                {body}
                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 3 }}>
                    <Button onClick={onCancel}>Cancel</Button>
                    <Button
                        onClick={handleAdd}
                        variant="contained"
                        disabled={submitDisabled}
                    >
                        {createPayment.isPending ? 'Recording...' : submitLabel}
                    </Button>
                </Stack>
                {picker}
            </Box>
        );
    }

    // Dialog variant: rendered inside <Dialog> by the wrapper.
    return (
        <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Record Loan Payment
                {headerActions}
            </DialogTitle>
            <DialogContent>
                {body}
            </DialogContent>
            {picker}
            <DialogActions>
                <Button onClick={onCancel}>Cancel</Button>
                <Button
                    onClick={handleAdd}
                    variant="contained"
                    disabled={submitDisabled}
                >
                    {createPayment.isPending ? 'Recording...' : submitLabel}
                </Button>
            </DialogActions>
        </>
    );
};

export default PaymentForm;
