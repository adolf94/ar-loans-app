import React, { useEffect } from 'react';
import { 
    Box, 
    CircularProgress, 
    Typography, 
    useTheme
} from '@mui/material';
import { useAuth } from '@adolf94/ar-auth-client';
import { useNavigate } from '@tanstack/react-router';
import useUserInfo from '../components/useUserInfo';

const CallbackPage: React.FC = () => {
    const theme = useTheme();
    const { isAuthenticated, isLoading } = useAuth();
    const { userInfo } = useUserInfo();
    const navigate = useNavigate();

    useEffect(() => {
        // If we are in a popup, the AuthProvider's signinPopupCallback 
        // will handle closing the window. This page just shows the processing state.
        if (window.opener) {
            return;
        }

        // If authenticated and the backend sync (in App.tsx) has finished
        if (!isLoading && isAuthenticated && userInfo.isAuthenticated) {
            const config = window.webConfig;
            const userRoles = userInfo.role || [];

            if (userRoles.includes(config.adminRole)) {
                navigate({ to: "/admin", replace: true });
            } else if (userRoles.includes(config.guarantorRole)) {
                navigate({ to: "/guarantor", replace: true });
            } else {
                navigate({ to: "/client", replace: true });
            }
        }
    }, [isAuthenticated, isLoading, userInfo.isAuthenticated, userInfo.role, navigate]);

    // Handle error state (e.g. login failed or cancelled)
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            // Check if there's an error in the URL before it was cleared, 
            // but usually we just redirect back to login if not authenticated after loading.
            const timeout = setTimeout(() => {
                if (!isAuthenticated) {
                    navigate({ to: "/", replace: true });
                }
            }, 5000); // Wait 5 seconds before giving up
            return () => clearTimeout(timeout);
        }
    }, [isLoading, isAuthenticated, navigate]);

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                background: `radial-gradient(circle at 50% 50%, ${theme.palette.primary.light}05 0%, ${theme.palette.background.default} 100%)`,
            }}
        >
            <CircularProgress 
                size={48} 
                thickness={4}
                sx={{
                    color: theme.palette.primary.main,
                }}
            />
            <Typography 
                variant="body1" 
                color="text.secondary" 
                fontWeight={500}
                sx={{ 
                    letterSpacing: '0.5px',
                    opacity: 0.8
                }}
            >
                Processing login...
            </Typography>
        </Box>
    );
};

export default CallbackPage;
