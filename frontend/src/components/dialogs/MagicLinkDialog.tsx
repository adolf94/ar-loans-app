import React, { useState } from 'react';
import { Button, Dialog, IconButton } from '../ui';
import { Copy, Check, Link as LinkIcon, Info } from 'lucide-react';
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
        <Dialog open={open} onClose={handleClose} title={`Link Account for ${userName}`} width="max-w-lg" actions={<Button variant="ghost" onClick={handleClose}>Close</Button>}>
            <p className="text-sm text-silver leading-relaxed mb-5">
                Generate a secure, durable magic link to allow this user to link their OIDC (Google) account to their profile.
            </p>

            {magicLink ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <input
                            readOnly
                            value={magicLink}
                            className="w-full bg-bay border border-line rounded-md px-3 py-2.5 text-sm text-paper font-mono truncate focus:border-amberdeep"
                        />
                        <IconButton label={copied ? "Copied!" : "Copy to clipboard"} onClick={handleCopy} className={copied ? 'text-good hover:text-good' : ''}>
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                        </IconButton>
                    </div>
                    <div className="border border-dashed border-linestrong rounded-md px-3.5 py-3 flex items-start gap-2.5">
                        <Info size={16} className="text-silverdim shrink-0 mt-0.5" />
                        <p className="text-xs text-silverdim leading-relaxed">
                            Send this link to the user. It will redirect them to sign in and automatically link their profile.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex justify-center py-3">
                    <Button variant="amber" onClick={handleGenerate} loading={generateMutation.isPending} startIcon={<LinkIcon size={17} strokeWidth={1.7} />}>
                        Generate Link
                    </Button>
                </div>
            )}
        </Dialog>
    );
};

export default MagicLinkDialog;
