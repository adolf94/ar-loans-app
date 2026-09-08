import React from 'react';
import { Box, Container } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import LoanForm from '../components/loans/LoanForm';

const NewLoanPage: React.FC = () => {
    const navigate = useNavigate();
    const params = new URLSearchParams(window.location.search);
    const ingestionId = params.get('ingestion_id') || undefined;

    const goAdmin = () => navigate({ to: '/admin' });

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Box>
                <LoanForm
                    key={ingestionId ?? 'blank'}
                    variant="inline"
                    ingestionId={ingestionId}
                    onSubmitted={goAdmin}
                    onCancel={goAdmin}
                />
            </Box>
        </Container>
    );
};

export default NewLoanPage;
