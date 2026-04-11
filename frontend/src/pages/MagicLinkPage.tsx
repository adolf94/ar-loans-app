import React, { useEffect, useState } from 'react';
import { 
    Box, 
    CircularProgress, 
    Typography, 
    useTheme
} from '@mui/material';
import { useAuth } from '@adolf94/ar-auth-client';

const MagicLinkPage: React.FC = () => {
    const theme = useTheme();
    const { login, isLoading: authLoading } = useAuth();
    const [initiated, setInitiated] = useState(false);

    const params = new URLSearchParams(window.location.search);
    const linkState = params.get('link_state');

    useEffect(() => {
        setInitiated(false);
    }, [linkState]);

    useEffect(() => {
        if (linkState && !authLoading && !initiated) {
            setInitiated(true);
            console.log("MagicLinkPage: Initiating redirect for state:", linkState);
            
            // Persist the state manually to ensure it survives redirects
            if (linkState) sessionStorage.setItem("magic_link_state", linkState);

            // Immediate redirect to OIDC provider
            // We use useRedirect: true to ensure a full page transition
            login({ state: linkState, useRedirect: true })
                .catch((err) => {
                    console.error("Magic login redirection failed:", err);
                    setInitiated(false);
                });
        }
    }, [authLoading, initiated, login, linkState]);

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
                logging you in....
            </Typography>
        </Box>
    );
};

export default MagicLinkPage;
