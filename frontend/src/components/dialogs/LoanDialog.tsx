import React, { useState } from 'react';
import {
    Dialog,
    useMediaQuery,
    useTheme
} from '@mui/material';
import type { Loan } from '../../@types/types';
import LoanForm from '../loans/LoanForm';

interface LoanDialogProps {
    onAddLoan: (loan: Loan) => void;
    currentLoansCount?: number;
    fixedGuarantorId?: string;
    ingestionId?: string;
    children?: React.ReactNode;
}

const LoanDialog: React.FC<LoanDialogProps> = ({ onAddLoan, fixedGuarantorId, ingestionId, children }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [open, setOpen] = useState(false);

    return <>
        {children && React.isValidElement(children) && React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) })}
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullScreen={isMobile} fullWidth>
            {open && (
                <LoanForm
                    key={ingestionId ?? 'blank'}
                    variant="dialog"
                    ingestionId={ingestionId}
                    fixedGuarantorId={fixedGuarantorId}
                    onSubmitted={(loan) => { setOpen(false); onAddLoan(loan); }}
                    onCancel={() => setOpen(false)}
                />
            )}
        </Dialog>
    </>;
};

export default LoanDialog;
