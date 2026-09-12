import React, { useState } from 'react';
import { Dialog } from '../ui';
import type { Payment } from '../../@types/types';
import PaymentForm from '../payments/PaymentForm';

interface PaymentDialogProps {
    onAddPayment: (payment: Payment) => void;
    children?: React.ReactNode;
    initialLoanId?: string;
    initialUserId?: string;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
    onAddPayment,
    children,
    initialLoanId,
    initialUserId
}) => {
    const [open, setOpen] = useState(false);

    return <>
        {children && React.isValidElement(children) && React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) })}
        <Dialog open={open} onClose={() => setOpen(false)} width="max-w-md">
            {open && (
                <PaymentForm
                    key="blank"
                    variant="dialog"
                    initialLoanId={initialLoanId}
                    initialUserId={initialUserId}
                    onSubmitted={(payment) => { setOpen(false); onAddPayment(payment); }}
                    onCancel={() => setOpen(false)}
                />
            )}
        </Dialog>
    </>;
};

export default PaymentDialog;
