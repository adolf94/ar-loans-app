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
    Stack
} from '@mui/material';
import type { GeneralLedgerEntry } from '../../@types/types';
import { useAccounts, type Account } from '../../repositories/account';
import dayjs from 'dayjs';
import {v7 as uuidv7} from 'uuid'
import { useCreateEntry, type Entry } from '../../repositories/entry';
interface LedgerDialogProps {
    onAddLedger: (entry: Entry) => void;
    currentLedgerCount: number;
        children?: React.ReactNode;
}

const empty_record = ()=>( {
        id:  uuidv7(),
        date: dayjs().format("YYYY-MM-DD"),
        description: "",
        amount: 0,
        debitId:"",
        creditId:""
    })

const LedgerDialog: React.FC<LedgerDialogProps> = ({  onAddLedger, currentLedgerCount, children }) => {
    const [newLedger, setNewLedger] = useState(empty_record());
    const [open,setOpen]= useState(false)
    const { data: accounts = [] } = useAccounts();
    const createEntry = useCreateEntry()
    const handleClose = () => {
        setNewLedger(empty_record());
        setOpen(false);
    };

    const handleAdd = async () => {
        const ledgerEntry: Entry = {
            ...newLedger,
        };
        let data = await createEntry.mutateAsync(ledgerEntry)
        onAddLedger(data);
        setOpen(false);
        setNewLedger(empty_record());
    };

    return <>
            {React.cloneElement(children, {onClick: ()=>setOpen(true)})}
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>Manual Ledger Entry</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Date"
                        type="date"
                        fullWidth
                        value={newLedger.date}
                        onChange={(e) => setNewLedger({ ...newLedger, date: e.target.value })}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                        label="Description"
                        fullWidth
                        value={newLedger.description}
                        onChange={(e) => setNewLedger({ ...newLedger, description: e.target.value })}
                    />
                    <TextField
                        label="Amount"
                        type="number"
                        fullWidth
                        value={newLedger.amount}
                        onChange={(e) => setNewLedger({ ...newLedger, amount: Number(e.target.value) })}
                    />
                    
                    <FormControl fullWidth>
                        <InputLabel>From(Credit):</InputLabel>
                        <Select
                            value={newLedger.creditId}
                            label="From(Credit):"
                            onChange={(e) => setNewLedger({ ...newLedger, creditId: e.target.value })}
                        >
                            {accounts.map((a: Account) => (
                                <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>To(Debit):</InputLabel>
                        <Select
                            value={newLedger.debitId}
                            label="From(Credit):"
                            onChange={(e) => setNewLedger({ ...newLedger, debitId: e.target.value })}
                        >
                            {accounts.map((a: Account) => (
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
                    disabled={!newLedger.description || newLedger.amount <= 0}
                >
                    Add Entry
                </Button>
            </DialogActions>
        </Dialog>
        </>
};

export default LedgerDialog;
