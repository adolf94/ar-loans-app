import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    IconButton,
    InputAdornment,
    Tooltip,
    Alert,
    Stack
} from '@mui/material';
import { Copy, Check, Link as LinkIcon } from 'lucide-react';
import { useGenerateMagicLink } from '../../repositories/user';

interface MagicLinkDialogProps {
    open: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
}

const MagicLinkDialog: React.FC<MagicLinkDialogProps> = ({ open, onClose, userId, userName }) => {
    const [magicLink, setMagicLink] = useState('');
    const [copied, setCopied] = useState(false);
    const generateMutation = useGenerateMagicLink();

    const handleGenerate = async () => {
        try {
            const url = await generateMutation.mutateAsync(userId);
            setMagicLink(url);
        } catch (error) {
            console.error('Failed to generate magic link:', error);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(magicLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleClose = () => {
        setMagicLink('');
        setCopied(false);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinkIcon size={20} />
                Link Account for {userName}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Generate a secure, durable magic link to allow this user to link their OIDC (Google) account to their profile.
                    </Typography>

                    {magicLink ? (
                        <Stack spacing={2}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                value={magicLink}
                                slotProps={{
                                    input: {
                                        readOnly: true,
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <Tooltip title={copied ? "Copied!" : "Copy to clipboard"}>
                                                    <IconButton onClick={handleCopy} edge="end" color={copied ? "success" : "primary"}>
                                                        {copied ? <Check size={20} /> : <Copy size={20} />}
                                                    </IconButton>
                                                </Tooltip>
                                            </InputAdornment>
                                        ),
                                    }
                                }}
                            />
                            <Alert severity="info" variant="outlined">
                                Send this link to the user. It will redirect them to sign in and automatically link their profile.
                            </Alert>
                        </Stack>
                    ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <Button 
                                variant="contained" 
                                onClick={handleGenerate}
                                loading={generateMutation.isPending}
                                startIcon={<LinkIcon size={18} />}
                            >
                                Generate Link
                            </Button>
                        </Box>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default MagicLinkDialog;
