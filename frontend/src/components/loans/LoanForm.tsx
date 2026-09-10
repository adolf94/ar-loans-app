import React, { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
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
    Collapse,
    Typography,
    FormHelperText,
    FormControlLabel,
    Switch,
    Alert,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import { Camera, Sparkles, UserPlus, ChevronDown, ChevronRight, Download } from 'lucide-react';
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
                return { ...newValue, ...updates };
            });
        } else {
            setNewLoan(prev => ({ ...prev, ...updates, ...otherUpdates }));
        }
    };

    // ---- Ingestion prefill ----
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linkedIngestion]);

    const handleAdd = async () => {
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
        <Box sx={{ display: 'flex', gap: 0.5 }}>
            <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                id={`loan-scan-input-${variant}`}
                onChange={handleImageUpload}
            />
            <label htmlFor={`loan-scan-input-${variant}`}>
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

    const header = (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>Issue New Loan</Typography>
            {headerActions}
        </Stack>
    );

    const body = (
        <Stack spacing={2} sx={{ mt: isInline ? 0 : 1 }}>
            {imported && (
                <Alert severity="success" variant="outlined">
                    <Typography variant="body2" fontWeight={600}>Imported from ingestion</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {ingestionDisplayText(imported) ?? 'Notification'} · {imported.id}
                    </Typography>
                </Alert>
            )}
            <Stack direction="row" spacing={1} alignItems="center">
                <FormControl fullWidth>
                    <InputLabel>Client</InputLabel>
                    <Select
                        value={newLoan.clientId}
                        label="Client"
                        onChange={(e) => { handleSelectUser(e.target.value); }}
                    >
                        {users.map(u => (
                            <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                        ))}
                    </Select>
                    {newLoan.interestRuleId && (
                        <FormHelperText>
                            <Sparkles size={12} /> Template: {rules.find(r => r.id === newLoan.interestRuleId)?.name}
                        </FormHelperText>
                    )}
                </FormControl>
                <UserDialog onAddUser={handleAddUser} imgData={imgData}>
                    <Tooltip title="Add New Client">
                        <IconButton color="primary" sx={{ border: '1px solid', borderColor: 'primary.light', borderRadius: 2 }}>
                            <UserPlus size={20} />
                        </IconButton>
                    </Tooltip>
                </UserDialog>
            </Stack>
            <TextField
                label="Date"
                type="date"
                fullWidth
                value={newLoan.date}
                onChange={(e) => setNewLoan({ ...newLoan, date: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
                label="Principal Amount"
                type="number"
                fullWidth
                value={newLoan.principal}
                onChange={(e) => setNewLoan({ ...newLoan, principal: Number(e.target.value) })}
            />
            <TextField
                label="Monthly Interest Rate (%)"
                type="number"
                fullWidth
                value={newLoan.interestRate}
                onChange={(e) => setNewLoan({ ...newLoan, interestRate: Number(e.target.value) })}
            />
            <FormControlLabel
                control={
                    <Switch
                        checked={newLoan.showAmortization}
                        onChange={(e) => setNewLoan({ ...newLoan, showAmortization: e.target.checked })}
                    />
                }
                label="Show Amortization Schedule"
            />
            {newLoan.showAmortization && (
                <Box sx={{ p: 1, bgcolor: 'primary.50', borderRadius: 1, border: '1px dashed', borderColor: 'primary.main' }}>
                    <Typography variant="caption" color="primary.main" fontWeight={600}>
                        Expected Monthly Payment:
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
                    </Typography>
                </Box>
            )}
            <Button
                size="small"
                variant="text"
                onClick={() => setShowAdvanced(!showAdvanced)}
                startIcon={showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                sx={{ alignSelf: 'flex-start', textTransform: 'none', fontSize: '0.8rem', color: 'text.secondary', px: 0.5, minHeight: 0, py: 0.5 }}
            >
                Advanced Settings
            </Button>
            <Collapse in={showAdvanced}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {rules.length > 0 && (
                        <FormControl fullWidth size="small">
                            <InputLabel>Interest Template</InputLabel>
                            <Select
                                value={newLoan.interestRuleId}
                                label="Interest Template"
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
                            >
                                <MenuItem value="">Custom / Manual</MenuItem>
                                {rules.map((r) => (
                                    <MenuItem key={r.id} value={r.id}>{r.name} ({r.interestPerMonth}%)</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                    <TextField
                        label="Grace Period (Days)"
                        type="number"
                        fullWidth
                        size="small"
                        value={newLoan.gracePeriodDays}
                        onChange={(e) => setNewLoan({ ...newLoan, gracePeriodDays: Number(e.target.value) })}
                    />
                    <TextField
                        label="Grace Period Interest (%)"
                        type="number"
                        fullWidth
                        size="small"
                        value={newLoan.gracePeriodInterest}
                        onChange={(e) => setNewLoan({ ...newLoan, gracePeriodInterest: Number(e.target.value) })}
                    />
                    <TextField
                        label="Late Payment Penalty (%)"
                        type="number"
                        fullWidth
                        size="small"
                        value={newLoan.latePaymentPenalty}
                        onChange={(e) => setNewLoan({ ...newLoan, latePaymentPenalty: Number(e.target.value) })}
                    />
                    <TextField
                        label="Term (Months)"
                        type="number"
                        fullWidth
                        size="small"
                        value={newLoan.termMonths}
                        onChange={(e) => setNewLoan({ ...newLoan, termMonths: Number(e.target.value) })}
                    />
                    <FormControl fullWidth size="small">
                        <InputLabel>Interest Computed On</InputLabel>
                        <Select
                            value={newLoan.interestBase}
                            label="Interest Computed On"
                            onChange={(e) => setNewLoan({ ...newLoan, interestBase: e.target.value as 'principal' | 'balance' | 'principalBalance' })}
                        >
                            <MenuItem value="principal">Original Principal</MenuItem>
                            <MenuItem value="balance">Remaining Balance (Capped at Principal)</MenuItem>
                            <MenuItem value="principalBalance">Principal Balance (Principal first payout)</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                        <InputLabel>Grace Period Activation</InputLabel>
                        <Select
                            value={newLoan.recurringGracePeriod ? 'monthly' : 'start'}
                            label="Grace Period Activation"
                            onChange={(e) => setNewLoan({ ...newLoan, recurringGracePeriod: e.target.value === 'monthly' })}
                        >
                            <MenuItem value="start">Start of Loan Only</MenuItem>
                            <MenuItem value="monthly">Monthly Basis (Every Month)</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </Collapse>
            <FormControl fullWidth>
                <InputLabel>Guarantor (Optional)</InputLabel>
                <Select
                    value={newLoan.guarantorId}
                    label="Guarantor (Optional)"
                    onChange={(e) => setNewLoan({ ...newLoan, guarantorId: e.target.value })}
                    disabled={!!fixedGuarantorId}
                >
                    <MenuItem value="">None</MenuItem>
                    {users.filter(u => ['Guarantor', "Admin"].indexOf(u.role) > -1).map(u => (
                        <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControl fullWidth>
                <InputLabel>Source Account (Asset)</InputLabel>
                <Select
                    value={newLoan.sourceAcct}
                    label="Source Account (Asset)"
                    onChange={(e) => setNewLoan({ ...newLoan, sourceAcct: e.target.value })}
                >
                    {assetAccounts.map((a: Account) => (
                        <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Stack>
    );

    const actions = (
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: isInline ? 3 : 0 }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button
                onClick={handleAdd}
                variant="contained"
                disabled={!newLoan.clientId || newLoan.principal <= 0 || !newLoan.sourceAcct || createLoan.isPending}
            >
                {createLoan.isPending ? 'Issuing...' : submitLabel}
            </Button>
        </Stack>
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
            <Box sx={{ maxWidth: 520, mx: 'auto' }}>
                {header}
                {body}
                {actions}
                {picker}
            </Box>
        );
    }

    // Dialog variant: rendered inside <Dialog> by the wrapper.
    return (
        <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Issue New Loan
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
                    disabled={!newLoan.clientId || newLoan.principal <= 0 || !newLoan.sourceAcct || createLoan.isPending}
                >
                    {createLoan.isPending ? 'Issuing...' : submitLabel}
                </Button>
            </DialogActions>
        </>
    );
};

export default LoanForm;
