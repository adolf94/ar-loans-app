import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Container,
    Paper,
    Stack,
    useTheme,
    Backdrop,
    CircularProgress,
    Button,
} from '@mui/material';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@adolf94/ar-auth-client';
import GoogleIcon from '@mui/icons-material/Google';
import TelegramIcon from '@mui/icons-material/Telegram';
import FingerprintIcon from '@mui/icons-material/Fingerprint';

interface LoginProps {
    onLogin: (data: any, user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const theme = useTheme();
    const { login, user, isAuthenticated, accessToken } = useAuth();
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async () => {
        setIsLoggingIn(true);
        try {
            await login();
        } catch (err) {
            console.error("Login failed:", err);
        } finally {
            setIsLoggingIn(false);
        }
    };

    // Fallback sync if needed, though App.tsx handles it
    useEffect(() => {
        if (isAuthenticated && user && accessToken) {
            onLogin({ access_token: accessToken }, user);
        }
    }, [isAuthenticated, user, accessToken, onLogin]);

    return (
        <Container maxWidth="sm">
            <Paper
                elevation={0}
                sx={{
                    p: 6,
                    borderRadius: 6,
                    textAlign: 'center',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.04)'
                }}
            >
                <Stack spacing={4} alignItems="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                            variant="h3"
                            sx={{
                                fontWeight: 900,
                                letterSpacing: '-1.5px',
                                background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            LendFlow
                        </Typography>
                    </Box>

                    <Typography variant="h5" fontWeight={700} color="text.primary">
                        Institutional Grade AI Micro-Lending
                    </Typography>

                    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '80%', mb: 2 }}>
                        Manage portfolios, analyze risk with Gemini 3 Flash, and streamline your accounting operations in one platform.
                    </Typography>

                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleLogin}
                        disabled={isLoggingIn}
                        sx={{
                            borderRadius: '16px',
                            px: 4,
                            py: 2,
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            background: 'linear-gradient(45deg, #2563eb 30%, #7c3aed 90%)',
                            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.2)',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                background: 'linear-gradient(45deg, #1d4ed8 30%, #6d28d9 90%)',
                                transform: 'translateY(-2px)',
                                boxShadow: '0 12px 32px rgba(37, 99, 235, 0.3)',
                            },
                        }}
                    >
                        <Stack direction="row" spacing={-1} sx={{ mr: 2 }}>
                            <Box sx={{
                                bgcolor: 'white',
                                borderRadius: '50%',
                                p: 0.5,
                                display: 'flex',
                                color: '#DB4437',
                                boxShadow: 2,
                                border: '1px solid #eee'
                            }}>
                                <GoogleIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box sx={{
                                bgcolor: 'white',
                                borderRadius: '50%',
                                p: 0.5,
                                display: 'flex',
                                color: '#0088cc',
                                boxShadow: 2,
                                border: '1px solid #eee',
                                zIndex: 1
                            }}>
                                <TelegramIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box sx={{
                                bgcolor: 'white',
                                borderRadius: '50%',
                                p: 0.5,
                                display: 'flex',
                                color: '#444',
                                boxShadow: 2,
                                border: '1px solid #eee',
                                zIndex: 2
                            }}>
                                <FingerprintIcon sx={{ fontSize: 18 }} />
                            </Box>
                        </Stack>
                        Sign In
                    </Button>

                    <Stack direction="row" spacing={1} alignItems="center">
                        <Sparkles size={16} color={theme.palette.primary.main} />
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Powered by Gemini 3 Flash
                        </Typography>
                    </Stack>
                </Stack>
            </Paper>

            <Backdrop
                sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
                open={isLoggingIn}
            >
                <CircularProgress color="inherit" />
            </Backdrop>
        </Container>
    );
};

export default Login;
