import React, { useState, useEffect } from 'react';
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
    Divider,
    IconButton,
    Typography,
    Box
} from '@mui/material';
import { Plus, Trash2, Camera, Sparkles, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { UserRole, User, UserAccount } from '../../@types/types';
import { extractDataFromImage } from '../../services/aiService';
import { decodeQRCode } from '../../services/qrService';
import { PHQRParser } from '../../services/qrph';
import { v7 as uuidv7 } from 'uuid';
import type { IdentifiedTransaction } from '../../repositories/file';
import { useCreateUser } from '../../repositories/user';

interface UserDialogProps {
    onAddUser: (user: User) => void;
    onUpdateUser?: (user: User) => void;
    imgData?: IdentifiedTransaction | null;
    userToEdit?: User | null;
    children?: React.ReactNode;
}

const UserDialog: React.FC<UserDialogProps> = ({ onAddUser, onUpdateUser, imgData, userToEdit, children }) => {
    const [newUser, setNewUser] = useState({
        id: uuidv7(),
        fullName: '',
        role: 'Client' as UserRole,
        mobileNumber: '',
        email: ''
    });
    const [open, setOpen] = useState(false);
    const [accounts, setAccounts] = useState<UserAccount[]>([]);
    const [newAccount, setNewAccount] = useState<UserAccount>({ bank: '', accountNumber: '', name: '' });
    const [isScanning, setIsScanning] = useState(false);
    const [viewQrAccount, setViewQrAccount] = useState<UserAccount | null>(null);


    const [trData, setTrData] = useState<IdentifiedTransaction | null>(null);
    const createUserMutation = useCreateUser();
    useEffect(() => {
        if (imgData) {
            setTrData(imgData);
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


    const addUser = () => {
        const user: User = {
            id: newUser.id,
            name: newUser.fullName,
            role: newUser.role,
            mobileNumber: newUser.mobileNumber,
            email: newUser.email,
            accounts: accounts
        };
    };

    const onClose = () => {
        setOpen(false);
        setNewUser({
            id: uuidv7(),
            fullName: '',
            role: 'Client' as UserRole,
            mobileNumber: '',
            email: ''
        });
        setAccounts([]);
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
                    email: userToEdit.email
                });
                setAccounts(userToEdit.accounts || []);
            }
            // else {
            //     // Reset for new user
            //     setNewUser({
            //         id: uuidv7(),
            //         fullName: '',
            //         role: 'Client' as UserRole,
            //         mobileNumber: '',
            //         email: ''
            //     });
            //     setAccounts([]);
            // }
        }
    }, [open, userToEdit]);

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target?.result as string;

            // Try local QR decode first
            const qrData = await decodeQRCode(base64);
            let finalData = null;

            if (qrData) {
                try {
                    // Try to parse as JSON first
                    finalData = JSON.parse(qrData);
                } catch {
                    // If not JSON, check if it's a PH QR code (standard EMV QR starts with 000201)
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
                        // Fallback to AI for general text QR
                        finalData = await extractDataFromImage(base64, 'User');
                    }
                }
            } else {
                // No QR found, use AI Vision
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
            accounts: accounts.length > 0 ? accounts : []
        };

        if (userToEdit && onUpdateUser) {
            onUpdateUser(user);
        } else {
            createUserMutation.mutateAsync(user).then(() => {
                onAddUser(user);
                onClose();
            });
        }

        setOpen(false);
    };

    return (
        <>
            {React.isValidElement(children) && React.cloneElement(children as React.ReactElement<any>, {
                onClick: (e: React.MouseEvent) => {
                    setOpen(true);
                    if ((children.props as any).onClick) (children.props as any).onClick(e);
                }
            })}
            <Dialog open={open} onClose={onClose}>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {userToEdit ? 'Update User' : 'Add New User'}
                    <Box>
                        <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="user-scan-input"
                            onChange={handleImageUpload}
                        />
                        <label htmlFor="user-scan-input">
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
                        <TextField
                            label="Full Name"
                            fullWidth
                            value={newUser.fullName}
                            onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                        />
                        <TextField
                            label="Mobile Number"
                            fullWidth
                            value={newUser.mobileNumber}
                            onChange={(e) => setNewUser({ ...newUser, mobileNumber: e.target.value })}
                        />
                        <TextField
                            label="Email"
                            fullWidth
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Role</InputLabel>
                            <Select
                                value={newUser.role}
                                label="Role"
                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                            >
                                <MenuItem value="Client">Client (Borrower)</MenuItem>
                                <MenuItem value="Guarantor">Guarantor</MenuItem>
                                <MenuItem value="Admin">Admin</MenuItem>
                            </Select>
                        </FormControl>

                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Disbursement Accounts
                        </Typography>

                        {accounts.map((acc, index) => (
                            <Box key={index} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, position: 'relative' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{acc.name}</Typography>
                                <Typography variant="caption" display="block">{acc.bank} - {acc.accountNumber}</Typography>
                                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                    {acc.qrData && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<QrCode size={14} />}
                                            onClick={() => setViewQrAccount(acc)}
                                            sx={{ py: 0, height: 24, fontSize: '0.7rem' }}
                                        >
                                            View QR
                                        </Button>
                                    )}
                                </Stack>
                                <IconButton
                                    size="small"
                                    onClick={() => handleRemoveAccount(index)}
                                    sx={{ position: 'absolute', right: 4, top: 4, color: 'error.main' }}
                                >
                                    <Trash2 size={16} />
                                </IconButton>
                            </Box>
                        ))}

                        <Stack direction="row" spacing={1}>
                            <TextField
                                label="Bank"
                                size="small"
                                value={newAccount.bank}
                                onChange={(e) => setNewAccount({ ...newAccount, bank: e.target.value })}
                            />
                            <TextField
                                label="Acc Num"
                                size="small"
                                value={newAccount.accountNumber}
                                onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                            />
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <TextField
                                label="Account Name"
                                fullWidth
                                size="small"
                                value={newAccount.name}
                                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                            />
                            <Button variant="outlined" size="small" onClick={handleAddAccount} startIcon={<Plus size={16} />}>
                                Add
                            </Button>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained" disabled={!newUser.fullName}>
                        {userToEdit ? 'Save Changes' : 'Add User'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* QR Code Viewer Dialog */}
            <Dialog open={!!viewQrAccount} onClose={() => setViewQrAccount(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ textAlign: 'center' }}>
                    QR Code - {viewQrAccount?.bank}
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    {viewQrAccount?.qrData && (
                        <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, boxShadow: 2 }}>
                            <QRCodeSVG value={viewQrAccount.qrData} size={250} level="H" includeMargin />
                        </Box>
                    )}
                    <Typography variant="h6" sx={{ mt: 3, fontWeight: 700 }}>
                        {viewQrAccount?.name}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {viewQrAccount?.accountNumber}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
                    <Button onClick={() => setViewQrAccount(null)} variant="outlined" sx={{ borderRadius: 2 }}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default UserDialog;
