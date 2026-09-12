import React, { useState } from 'react';
import { Button, Dialog, Input, Select } from '../ui';
import { useAccounts, type Account } from '../../repositories/account';
import dayjs from 'dayjs';
import { v7 as uuidv7 } from 'uuid'
import { useCreateEntry, type Entry } from '../../repositories/entry';
import { identifyTransaction, type IdentifiedTransaction } from '../../repositories/file';
import { getBankAccountByAccountId } from '../../repositories/bankAccount';
import { Camera, Sparkles } from 'lucide-react';
import { useDateValidation } from '../../logic/dateValidation';
interface LedgerDialogProps {
    onAddLedger: (entry: Entry) => void;
    currentLedgerCount: number;
    children?: React.ReactNode;
}

const empty_record = () => ({
    id: uuidv7(),
    date: dayjs().format("YYYY-MM-DD"),
    description: "",
    fileId: "",
    amount: 0,
    debitId: "",
    creditId: ""
})

const LedgerDialog: React.FC<LedgerDialogProps> = ({ onAddLedger, children }) => {
    const [newLedger, setNewLedger] = useState(empty_record());
    const [open, setOpen] = useState(false)
    const [isScanning, setIsScanning] = useState(false)
    const [, setImgData] = useState<IdentifiedTransaction | null>(null)
    const [attempted, setAttempted] = useState(false)
    const { data: accounts = [] } = useAccounts();
    const createEntry = useCreateEntry()
    const validateDate = useDateValidation();
    const handleClose = () => {
        setNewLedger(empty_record());
        setOpen(false);
    };

    const handleAdd = async () => {
        setAttempted(true);
        if (!(await validateDate(newLedger.date))) {
            return;
        }

        const ledgerEntry: Entry = {
            ...newLedger,
        };
        const data = await createEntry.mutateAsync(ledgerEntry)
        onAddLedger(data as unknown as Entry);
        setOpen(false);
        setNewLedger(empty_record());
    };


    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        try {
            const data = await identifyTransaction(file);
            if (data) {
                setImgData(data);

                var recipient = await getBankAccountByAccountId(data.recipientAcct)
                    .catch(err => {
                        console.error("Error getting bank account:", err);
                        return null;
                    });
                var sender = await getBankAccountByAccountId(data.senderAcct)
                    .catch(err => {
                        console.error("Error getting bank account:", err);
                        return null;
                    });

                setNewLedger((prev) => ({
                    ...prev,
                    date: dayjs(data.datetime).format("YYYY-MM-DD") || prev.date,
                    creditId: sender?.accountId || "",
                    debitId: recipient?.accountId || "",
                    amount: data?.amount,
                    fileId: data.fileId
                }))

            }
        } catch (error) {
            console.error("Error identifying transaction:", error);
        } finally {
            setIsScanning(false);
            event.target.value = '';
        }
    };

    const accountOptions = accounts.map((a: Account) => ({ value: a.id, label: a.name }));
    const missingDescription = !newLedger.description;
    const missingAmount = newLedger.amount <= 0;

    return <>
        {children && React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) })}
        <Dialog open={open} onClose={handleClose} width="max-w-md">
            <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="text-paper font-semibold text-xl tracking-tight">Ledger Entry</h2>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="loan-scan-input"
                        onChange={handleImageUpload}
                    />
                    <label
                        htmlFor="loan-scan-input"
                        title={isScanning ? 'Scanning...' : 'Scan a receipt screenshot'}
                        className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-linestrong text-silver hover:text-paper hover:border-amberdeep transition-colors cursor-pointer ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                        {isScanning ? <Sparkles size={16} className="animate-pulse" /> : <Camera size={16} strokeWidth={1.7} />}
                        {isScanning ? 'Scanning...' : 'Scan Receipt'}
                    </label>
                </div>
            </div>

            <div className="space-y-4">
                <Input
                    label="Date"
                    type="date"
                    value={newLedger.date}
                    onChange={(e) => setNewLedger({ ...newLedger, date: e.target.value })}
                />
                <Input
                    label="Description"
                    value={newLedger.description}
                    onChange={(e) => setNewLedger({ ...newLedger, description: e.target.value })}
                    error={attempted && missingDescription ? 'Description is empty — write what this entry is for.' : ''}
                />
                <Input
                    label="Amount (P)"
                    type="number"
                    className="tnum"
                    value={newLedger.amount}
                    onChange={(e) => setNewLedger({ ...newLedger, amount: Number(e.target.value) })}
                    error={attempted && missingAmount ? 'Amount must be greater than zero — enter the figure from the receipt.' : ''}
                />
                <Select
                    label="From (Credit)"
                    value={newLedger.creditId}
                    onChange={(e) => setNewLedger({ ...newLedger, creditId: e.target.value })}
                    options={[{ value: '', label: 'Select source account', disabled: true }, ...accountOptions]}
                />
                <Select
                    label="To (Debit)"
                    value={newLedger.debitId}
                    onChange={(e) => setNewLedger({ ...newLedger, debitId: e.target.value })}
                    options={[{ value: '', label: 'Select destination account', disabled: true }, ...accountOptions]}
                />
            </div>

            <div className="mt-6 pt-4 border-t border-line flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                <Button
                    onClick={handleAdd}
                    disabled={missingDescription || missingAmount || createEntry.isPending}
                    loading={createEntry.isPending}
                >
                    {createEntry.isPending ? 'Posting...' : 'Post entry'}
                </Button>
            </div>
        </Dialog>
    </>
};

export default LedgerDialog;
