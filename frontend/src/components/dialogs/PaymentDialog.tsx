import React, { useState } from 'react';
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
    Box
} from '@mui/material';
import { Camera, Sparkles } from 'lucide-react';
import type { User, Loan, Transaction, Payment } from '../../@types/types';
import { extractDataFromImage } from '../../services/aiService';
import { decodeQRCode } from '../../services/qrService';
import { useLoansFiltered } from '../../repositories/loan';
import { useLoans } from '../../repositories/loan';
import { v7 as uuidv7 } from "uuid"
import { useAccounts, type Account } from '../../repositories/account';
import { identifyTransaction, type IdentifiedTransaction } from '../../repositories/file';
import { getBankAccountByAccountId } from '../../repositories/bankAccount';
import dayjs from 'dayjs';
import { useCreatePayment } from '../../repositories/payment';
import { useUsers } from '../../repositories/user';

interface PaymentDialogProps {
    onAddPayment: (payment: Payment) => void;
    children?: React.ReactNode;
}

const empty_payment = () => ({ loanId: "", amount: 0, date: new Date().toISOString().split('T')[0], destinationAcctId: "", description: "", userId: "", id: uuidv7() })

const PaymentDialog: React.FC<PaymentDialogProps> = ({
    onAddPayment,
    children
}) => {
    const [newPayment, setNewPayment] = useState<Payment>(empty_payment());
    const [isScanning, setIsScanning] = useState(false);
    const [open, setOpen] = useState(false)
    const [imgData, setImgData] = useState<IdentifiedTransaction | null>(null);
    // Fetch only active loans for payment
    const { data: activeLoans = [] } = useLoansFiltered('Active');
    const { data: users = [] } = useUsers()
    const { data: accounts = [] } = useAccounts();
    const createPayment = useCreatePayment()
    const assetAccounts = accounts.filter((a: Account) => a.section === 'Assets');


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

                // setFound(acct != null)

                // var recipient = await getBankAccountByAccountId(data.senderAcct)
                //     .catch(err => {
                //         console.error("Error getting bank account:", err);
                //         return null;
                //     });

                setNewPayment(prev => ({
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

    const handleClose = () => {
        setNewPayment(empty_payment());
        setOpen(false);
    };

    const handleAdd = async () => {
        const payment: Payment = {
            ...newPayment,
        };
        let data = await createPayment.mutateAsync(payment)
        onAddPayment(payment);
        setNewPayment(empty_payment());
    };

    return <>
        {React.cloneElement(children, { onClick: () => setOpen(true) })}
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Record Loan Payment
                <Box>
                    <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="payment-scan-input"
                        onChange={handleImageUpload}
                    />
                    <label htmlFor="payment-scan-input">
                        <Button
                            component="span"
                            variant="outlined"
                            size="small"
                            startIcon={isScanning ? <Sparkles className="animate-pulse" size={16} /> : <Camera size={16} />}
                            disabled={isScanning}
                            sx={{ borderRadius: 2 }}
                        >
                            {isScanning ? 'Scanning...' : 'AI Scan'}
                        </Button>
                    </label>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <FormControl fullWidth>
                        <InputLabel>Active Loan</InputLabel>
                        <Select
                            value={newPayment.loanId}
                            label="Active Loan"
                            onChange={(e) => setNewPayment({ ...newPayment, loanId: e.target.value, userId: (activeLoans.find(f => f.id == e.target.value))?.clientId! })}
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
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button
                    onClick={handleAdd}
                    variant="contained"
                    disabled={!newPayment.loanId || newPayment.amount == 0}
                >
                    Record Payment
                </Button>
            </DialogActions>
        </Dialog>
    </>
};

export default PaymentDialog;
