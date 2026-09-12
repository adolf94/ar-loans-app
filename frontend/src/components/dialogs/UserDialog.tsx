import React, { useState, useEffect } from 'react';
import { Button, Dialog, IconButton, Input, Select } from '../ui';
import { Plus, Trash2, Camera, Sparkles, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { UserRole, User, UserAccount } from '../../@types/types';
import { extractDataFromImage } from '../../services/aiService';
import { decodeQRCode } from '../../services/qrService';
import { PHQRParser } from '../../services/qrph';
import { v7 as uuidv7 } from 'uuid';
import type { IdentifiedTransaction } from '../../repositories/file';
import { useCreateUser } from '../../repositories/user';
import { useGetInterestRules } from '../../repositories/interestRule';

interface UserDialogProps {
    onAddUser: (user: User) => void;
    onUpdateUser?: (user: User) => void;
    imgData?: IdentifiedTransaction | null;
    userToEdit?: User | null;
    children?: React.ReactNode;
    openOverride?: boolean;
    onCloseOverride?: () => void;
}

const UserDialog: React.FC<UserDialogProps> = ({
    onAddUser,
    onUpdateUser,
    imgData,
    userToEdit,
    children,
    openOverride,
    onCloseOverride
}) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = openOverride !== undefined ? openOverride : internalOpen;

    const [newUser, setNewUser] = useState({
        id: uuidv7(),
        fullName: '',
        role: 'Client' as UserRole,
        mobileNumber: '',
        email: '',
        defaultInterestRuleId: ''
    });
    const [accounts, setAccounts] = useState<UserAccount[]>([]);
    const [newAccount, setNewAccount] = useState<UserAccount>({ bank: '', accountNumber: '', name: '' });
    const [isScanning, setIsScanning] = useState(false);
    const [viewQrAccount, setViewQrAccount] = useState<UserAccount | null>(null);



    const createUserMutation = useCreateUser();
    const { data: rules = [] } = useGetInterestRules();

    useEffect(() => {
        if (imgData) {
            setAccounts([{
                name: imgData.recipientName,
                bank: imgData.recipientBank,
                accountNumber: imgData.recipientAcct
            }]);
            setNewUser(prev => ({
                ...prev,
                fullName: imgData.recipientName,
                role: 'Client'
            }));
        }
    }, [imgData]);




    const onClose = () => {
        if (onCloseOverride) {
            onCloseOverride();
        } else {
            setInternalOpen(false);
        }

        if (!userToEdit) {
            setNewUser({
                id: uuidv7(),
                fullName: '',
                role: 'Client' as UserRole,
                mobileNumber: '',
                email: '',
                defaultInterestRuleId: ''
            });
            setAccounts([]);
        }
        setNewAccount({ bank: '', accountNumber: '', name: '' });
        setIsScanning(false);
        setViewQrAccount(null);
    };
    useEffect(() => {
        if (open) {
            if (userToEdit) {
                setNewUser({
                    id: userToEdit.id,
                    fullName: userToEdit.name,
                    role: userToEdit.role,
                    mobileNumber: userToEdit.mobileNumber || '',
                    email: userToEdit.email,
                    defaultInterestRuleId: userToEdit.defaultInterestRuleId || ''
                });
                setAccounts(userToEdit.accounts || []);
            }
        }
    }, [open, userToEdit]);

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target?.result as string;

            const qrData = await decodeQRCode(base64);
            let finalData = null;

            if (qrData) {
                try {
                    finalData = JSON.parse(qrData);
                } catch {
                    if (qrData.startsWith('000201')) {
                        const extracted = PHQRParser.extract(qrData);
                        finalData = {
                            accounts: [{
                                name: extracted.receiver,
                                bank: extracted.bank,
                                accountNumber: extracted.accountNumber,
                                qrData: qrData
                            }],
                            fullName: extracted.receiver
                        };
                    } else {
                        finalData = await extractDataFromImage(base64, 'User');
                    }
                }
            } else {
                finalData = await extractDataFromImage(base64, 'User');
            }

            if (finalData) {
                setNewUser(prev => ({
                    ...prev,
                    fullName: finalData.fullName || finalData.name || prev.fullName,
                    email: finalData.email || prev.email,
                    mobileNumber: finalData.mobileNumber || finalData.phone || prev.mobileNumber,
                    role: finalData.role || prev.role
                }));
                if (finalData.accounts && Array.isArray(finalData.accounts)) {
                    setAccounts(prev => [...prev, ...finalData.accounts]);
                }
            }
            setIsScanning(false);
        };
        reader.readAsDataURL(file);
    };

    const handleAddAccount = () => {
        if (newAccount.bank && newAccount.accountNumber && newAccount.name) {
            setAccounts([...accounts, newAccount]);
            setNewAccount({ bank: '', accountNumber: '', name: '' });
        }
    };

    const handleRemoveAccount = (index: number) => {
        setAccounts(accounts.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        const user: User = {
            id: userToEdit?.id || newUser.id,
            name: newUser.fullName,
            role: newUser.role,
            email: newUser.email,
            mobileNumber: newUser.mobileNumber,
            accounts: accounts.length > 0 ? accounts : [],
            defaultInterestRuleId: newUser.defaultInterestRuleId || undefined
        };

        if (userToEdit && onUpdateUser) {
            onUpdateUser(user);
            if (openOverride === undefined) {
                setInternalOpen(false);
            }
        } else {
            createUserMutation.mutateAsync(user).then(() => {
                onAddUser(user);
                onClose();
            });
        }

        if (openOverride === undefined) setInternalOpen(false);
    };

    return (
        <>
            {React.isValidElement(children) && React.cloneElement(children as React.ReactElement<any>, {
                onClick: (e: React.MouseEvent) => {
                    if (openOverride === undefined) setInternalOpen(true);
                    if ((children.props as any).onClick) (children.props as any).onClick(e);
                }
            })}
            <Dialog open={open} onClose={onClose} width="max-w-lg">
                <div className="flex items-center justify-between gap-3 mb-5">
                    <h2 className="text-paper font-semibold text-xl tracking-tight">
                        {userToEdit ? 'Update User' : 'Add New User'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="user-scan-input"
                            onChange={handleImageUpload}
                        />
                        <label
                            htmlFor="user-scan-input"
                            title={isScanning ? 'Scanning...' : 'Scan a QR code or ID photo'}
                            className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-linestrong text-silver hover:text-paper hover:border-amberdeep transition-colors cursor-pointer ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {isScanning ? <Sparkles size={16} className="animate-pulse" /> : <Camera size={16} strokeWidth={1.7} />}
                            {isScanning ? 'Scanning...' : 'AI Scan'}
                        </label>
                    </div>
                </div>

                <div className="space-y-4">
                    <Input
                        label="Full Name"
                        value={newUser.fullName}
                        onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                        error={!newUser.fullName ? 'Enter a full name — the user is filed under it.' : ''}
                    />
                    <Input
                        label="Mobile Number"
                        value={newUser.mobileNumber}
                        onChange={(e) => setNewUser({ ...newUser, mobileNumber: e.target.value })}
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                    <Select
                        label="Role"
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                        options={[
                            { value: 'Client', label: 'Client (Borrower)' },
                            { value: 'Guarantor', label: 'Guarantor' },
                            { value: 'Admin', label: 'Admin' }
                        ]}
                    />

                    {newUser.role === 'Client' && rules.length > 0 && (
                        <Select
                            label="Default Interest template"
                            value={newUser.defaultInterestRuleId}
                            onChange={(e) => setNewUser({ ...newUser, defaultInterestRuleId: e.target.value })}
                            options={[
                                { value: '', label: 'None' },
                                ...rules.map(r => ({ value: r.id, label: `${r.name} (${r.interestPerMonth}%)` }))
                            ]}
                        />
                    )}

                    <div className="pt-2">
                        <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim mb-2">Disbursement Accounts</p>

                        {viewQrAccount && (
                            <div className="border border-linestrong rounded-tray bg-bay2/70 p-4 flex flex-col items-center text-center mb-3">
                                <p className="text-[11px] font-mono tracking-[0.16em] uppercase text-silverdim">QR Code — {viewQrAccount.bank}</p>
                                <div className="bg-white rounded-md p-3 mt-3 shadow-[0_2px_12px_rgba(0,0,0,.5)]">
                                    {viewQrAccount.qrData && (
                                        <QRCodeSVG value={viewQrAccount.qrData} size={250} level="H" includeMargin />
                                    )}
                                </div>
                                <p className="text-paper font-semibold mt-3">{viewQrAccount.name}</p>
                                <p className="text-sm text-silverdim">{viewQrAccount.accountNumber}</p>
                                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setViewQrAccount(null)}>Close</Button>
                            </div>
                        )}

                        {accounts.length > 0 && (
                            <div className="divide-y divide-line/70 border border-linestrong rounded-tray bg-bay2/70 mb-3">
                                {accounts.map((acc, index) => (
                                    <div key={index} className="relative px-4 py-3">
                                        <p className="text-sm font-semibold text-paper">{acc.name}</p>
                                        <p className="text-xs text-silverdim font-mono mt-0.5">{acc.bank} - {acc.accountNumber}</p>
                                        <div className="mt-2 flex items-center gap-2">
                                            {acc.qrData && (
                                                <Button size="sm" variant="outline" startIcon={<QrCode size={13} strokeWidth={1.7} />} onClick={() => setViewQrAccount(acc)}>
                                                    View QR
                                                </Button>
                                            )}
                                        </div>
                                        <IconButton
                                            label="Remove account"
                                            onClick={() => handleRemoveAccount(index)}
                                            className="absolute right-2 top-2 border-transparent hover:text-bad hover:border-bad"
                                        >
                                            <Trash2 size={15} strokeWidth={1.7} />
                                        </IconButton>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Bank"
                                value={newAccount.bank}
                                onChange={(e) => setNewAccount({ ...newAccount, bank: e.target.value })}
                            />
                            <Input
                                label="Acc Num"
                                value={newAccount.accountNumber}
                                onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                            />
                        </div>
                        <div className="mt-3 flex items-end gap-2">
                            <div className="flex-1">
                                <Input
                                    label="Account Name"
                                    value={newAccount.name}
                                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                                />
                            </div>
                            <Button variant="outline" size="md" onClick={handleAddAccount} startIcon={<Plus size={15} strokeWidth={2.2} />} className="mb-0.5">
                                Add
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-line flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!newUser.fullName}>
                        {userToEdit ? 'Save user' : 'Add User'}
                    </Button>
                </div>
            </Dialog>
        </>
    );
};

export default UserDialog;
