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
    Box
} from '@mui/material';
import { useCreateAccount, type Account } from '../../repositories/account';

interface AccountDialogProps {
    open: boolean;
    onClose: () => void;
}

const AccountDialog: React.FC<AccountDialogProps> = ({ open, onClose }) => {
    const createAccount = useCreateAccount();
    const [formData, setFormData] = useState<Partial<Account>>({
        name: '',
        section: 'Assets',
        balance: 0
    });

    const handleSave = async () => {
        if (!formData.name || !formData.section) return;

        await createAccount.mutateAsync(formData);
        setFormData({ name: '', section: 'Assets', balance: 0 });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Add New Account</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label="Account Name"
                        fullWidth
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Section</InputLabel>
                        <Select
                            label="Section"
                            value={formData.section}
                            onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                        >
                            <MenuItem value="Assets">Assets</MenuItem>
                            <MenuItem value="Liabilities">Liabilities</MenuItem>
                            <MenuItem value="Income">Income</MenuItem>
                            <MenuItem value="Expense">Expense</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        label="Starting Balance"
                        type="number"
                        fullWidth
                        value={formData.balance}
                        onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={!formData.name || createAccount.isPending}
                >
                    {createAccount.isPending ? 'Saving...' : 'Add Account'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AccountDialog;
