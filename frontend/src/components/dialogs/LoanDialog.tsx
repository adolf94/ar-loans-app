import React, { useState } from 'react';
import { Dialog } from '../ui';
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
    const [open, setOpen] = useState(false);

    return <>
        {children && React.isValidElement(children) && React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) })}
        <Dialog open={open} onClose={() => setOpen(false)} width="max-w-lg">
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
