import React, { useState } from 'react';
import { useCreateAccount, type Account } from '../../repositories/account';
import { Dialog, Button, Input, Select } from '../ui';

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
        <Dialog
            open={open}
            onClose={onClose}
            title="Add New Account"
            width="max-w-sm"
            actions={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleSave}
                        disabled={!formData.name || createAccount.isPending}
                        loading={createAccount.isPending}
                    >
                        {createAccount.isPending ? 'Saving...' : 'Add Account'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <Input
                    label="Account Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <Select
                    label="Section"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    options={[
                        { value: 'Assets', label: 'Assets' },
                        { value: 'Liabilities', label: 'Liabilities' },
                        { value: 'Income', label: 'Income' },
                        { value: 'Expense', label: 'Expense' }
                    ]}
                />
                <Input
                    label="Starting Balance"
                    type="number"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
                />
            </div>
        </Dialog>
    );
};

export default AccountDialog;
