import React, { useState, type SetStateAction } from 'react';
import dayjs from 'dayjs';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
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
    useMediaQuery,
    useTheme,
    Collapse,
    Typography,
    FormHelperText
} from '@mui/material';
import { Camera, Sparkles, UserPlus, ChevronDown, ChevronRight } from 'lucide-react';
import type { User, Loan, UserAccount } from '../../@types/types';
import { identifyTransaction, type IdentifiedTransaction } from '../../repositories/file';
import UserDialog from './UserDialog';
import { getBankAccountByAccountId, createBankAccount } from '../../repositories/bankAccount';
import { v7 as uuidv7 } from 'uuid';
import { useCreateLoan } from '../../repositories/loan';
import { useAccounts, type Account } from '../../repositories/account';
import { useUsers } from '../../repositories/user';
import { useGetInterestRules } from '../../repositories/interestRule';
import { useDateValidation } from '../../logic/dateValidation';

interface LoanDialogProps {
    onAddLoan: (loan: Loan) => void;
    currentLoansCount: number;
    fixedGuarantorId?: string;
    children?: React.ReactNode;
}

const LoanDialog: React.FC<LoanDialogProps> = ({ onAddLoan, fixedGuarantorId, children }) => {
    const [newLoan, setNewLoan] = useState({
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
        interestBase: 'principal' as 'principal' | 'balance'
    });
    const theme = useTheme()
    const [open, setOpen] = useState(false)
    const [showAdvanced, setShowAdvanced] = useState(false);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [imgData, setImgData] = useState<IdentifiedTransaction | null>(null);
    const [found, setFound] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const createLoan = useCreateLoan()
    const { data: accounts = [] } = useAccounts();
    const { data: users = [] } = useUsers();
    const { data: rules = [] } = useGetInterestRules();
    const validateDate = useDateValidation();
    const assetAccounts = accounts.filter((a: Account) => a.section === 'Assets');
    const handleClose = () => {
        setNewLoan({
            id: uuidv7(),
            alternateId: "",
            clientId: '',
            principal: 0,
            interestRate: 10,
            termMonths: 12,
            guarantorId: fixedGuarantorId || '',
            date: dayjs().format('YYYY-MM-DD'),
            sourceAcct: '',
            fileId: '',
            gracePeriodDays: 0,
            gracePeriodInterest: 0,
            latePaymentPenalty: 0,
            interestRuleId: window.webConfig.defaultLoanTemplate,
            interestBase: 'principal' as 'principal' | 'balance'
        });
        setOpen(false);
    };




    const handleSelectUser = (selectedUserId: string, otherUpdates: any = {}) => {
        const selectedUser = users.find(u => u.id === selectedUserId);
        let updates: any = { clientId: selectedUserId };

        const selectDefaultId = selectedUser?.defaultInterestRuleId || window.webConfig.defaultLoanTemplate

        const rule = rules.find(r => r.id === selectDefaultId);
        if (rule) {
            updates.interestRuleId = rule.id;
            updates.interestRate = rule.interestPerMonth;
            updates.termMonths = rule.defaultTerms;
            updates.gracePeriodDays = rule.gracePeriodDays;
            updates.gracePeriodInterest = rule.gracePeriodInterest;
            updates.latePaymentPenalty = rule.latePaymentPenalty;
            updates.interestBase = rule.interestBase;
        }

        if (typeof otherUpdates === 'function') {
            setNewLoan(prev => {
                let newValue = otherUpdates(prev)
                return { ...newValue, ...updates }
            });
        } else {
            setNewLoan(prev => ({ ...prev, ...updates, ...otherUpdates }));
        }

    };


    const handleAdd = async () => {
        if (!(await validateDate(newLoan.date))) {
            return;
        }

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
            transactions: []
        };
        if (!found && !!imgData) {
            var userAcct: UserAccount = {
                name: imgData.recipientName,
                accountNumber: imgData.recipientAcct,
                bank: imgData.recipientBank,
                userId: newLoan.clientId
            }
            await createBankAccount(userAcct);
        }
        await createLoan.mutateAsync(loan).then(res => onAddLoan(res));
        handleClose();
        setNewLoan({
            id: uuidv7(),
            alternateId: "",
            clientId: '',
            principal: 0,
            interestRate: 10,
            termMonths: 12,
            guarantorId: fixedGuarantorId || '',
            date: dayjs().format('YYYY-MM-DD'),
            sourceAcct: '',
            fileId: '',
            gracePeriodDays: 0,
            gracePeriodInterest: 0,
            latePaymentPenalty: 0,
            interestRuleId: window.webConfig.defaultLoanTemplate,
            interestBase: 'principal' as 'principal' | 'balance'
        });
    };


    const handleAddUser = (user: User) => {
        setNewLoan(prev => ({
            ...prev,
            clientId: user.id
        }));
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        try {
            const data = await identifyTransaction(file);
            if (data) {
                //get user By accountId
                setImgData(data);

                var acct = await getBankAccountByAccountId(data.recipientAcct)
                    .catch(err => {
                        console.error("Error getting bank account:", err);
                        return null;
                    });

                setFound(acct != null)

                var recipient = await getBankAccountByAccountId(data.senderAcct)
                    .catch(err => {
                        console.error("Error getting bank account:", err);
                        return null;
                    });

                handleSelectUser(acct?.userId || '', (prev: any) => {
                    return {
                        alternateId: `${data.reference.slice(-6)}-${dayjs(data.datetime).format("DD")}-${newLoan.id.slice(-4)}`,
                        principal: data.amount || prev.principal,
                        sourceAcct: recipient?.accountId || prev.sourceAcct,
                        fileId: data.fileId || '',
                        date: data.datetime ? dayjs(data.datetime).format('YYYY-MM-DD') : prev.date
                    }
                });
            }
        } catch (error) {
            console.error("Error identifying transaction:", error);
        } finally {
            setIsScanning(false);
            // Reset input
            event.target.value = '';
        }
    };

    return <>
        {React.cloneElement(children, { onClick: () => setOpen(true) })}
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullScreen={isMobile} fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Issue New Loan
                <Box>
                    <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="loan-scan-input"
                        onChange={handleImageUpload}
                    />
                    <label htmlFor="loan-scan-input">
                        <Button
                            component="span"
                            variant="outlined"
                            size="small"
                            startIcon={isScanning ? <Sparkles className="animate-pulse" size={16} /> : <Camera size={16} />}
                            disabled={isScanning}
                            sx={{ borderRadius: 2 }}
                        >
                            {isScanning ? 'Scanning...' : 'Scan Receipt'}
                        </Button>
                    </label>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl fullWidth>
                            <InputLabel>Client</InputLabel>
                            <Select
                                value={newLoan.clientId}
                                label="Client"
                                onChange={(e) => {
                                    handleSelectUser(e.target.value);
                                }}
                            >
                                {users.map(u => (
                                    <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                                ))}
                            </Select>
                            {newLoan.interestRuleId && (
                                <FormHelperText>
                                    {/* <Typography variant="caption" sx={{ mt: -1.5, ml: 1, color: 'primary.main', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}> */}
                                    <Sparkles size={12} /> Template: {rules.find(r => r.id === newLoan.interestRuleId)?.name}
                                    {/* </Typography> */}
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
                                            let updates: any = { interestRuleId: selectedId };
                                            if (selectedId) {
                                                const rule = rules.find(r => r.id === selectedId);
                                                if (rule) {
                                                    updates.interestRate = rule.interestPerMonth;
                                                    updates.termMonths = rule.defaultTerms;
                                                    updates.gracePeriodDays = rule.gracePeriodDays;
                                                    updates.gracePeriodInterest = rule.gracePeriodInterest;
                                                    updates.latePaymentPenalty = rule.latePaymentPenalty;
                                                    updates.interestBase = rule.interestBase;
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
                                    onChange={(e) => setNewLoan({ ...newLoan, interestBase: e.target.value as 'principal' | 'balance' })}
                                >
                                    <MenuItem value="principal">Original Principal</MenuItem>
                                    <MenuItem value="balance">Remaining Balance</MenuItem>
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
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button
                    onClick={handleAdd}
                    variant="contained"
                    disabled={!newLoan.clientId || newLoan.principal <= 0 || !newLoan.sourceAcct}
                >
                    Issue Loan
                </Button>
            </DialogActions>
        </Dialog></>
};

export default LoanDialog;
