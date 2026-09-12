import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import LoanForm from '../components/loans/LoanForm';
import { SectionTitle } from '../components/ui';

const NewLoanPage: React.FC = () => {
    const navigate = useNavigate();
    const params = new URLSearchParams(window.location.search);
    const ingestionId = params.get('ingestion_id') || undefined;

    const goAdmin = () => navigate({ to: '/admin' });

    return (
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8">
            <button
                onClick={goAdmin}
                className="inline-flex items-center gap-1.5 text-xs font-mono tracking-wider uppercase text-silverdim hover:text-amber transition-colors"
            >
                <ArrowLeft size={14} />
                Back to overview
            </button>
            <SectionTitle className="mt-4">Issue a loan</SectionTitle>
            <p className="text-sm text-silverdim mt-1 mb-6">
                New loan agreement, disbursed from the circle's cash.
            </p>
            <LoanForm
                key={ingestionId ?? 'blank'}
                variant="inline"
                ingestionId={ingestionId}
                onSubmitted={goAdmin}
                onCancel={goAdmin}
            />
        </div>
    );
};

export default NewLoanPage;
