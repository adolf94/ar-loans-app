import React from 'react';
import {
    Box,
    Typography,
    Container,
    Paper,
    Stack,
    useTheme,
    Backdrop,
    CircularProgress
} from '@mui/material';
import { Sparkles } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import axios from 'axios';
import useUserInfo from '../useUserInfo';
import type { User } from '../../@types/types';

interface LoginProps {
    onLogin: (data: any, user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const theme = useTheme();
    const { setUserInfo } = useUserInfo()
    const [isLoggingIn, setIsLoggingIn] = React.useState(false);

    const onGoogleSuccess = (data: CredentialResponse) => {
        setIsLoggingIn(true);
        axios.post(`${window.webConfig.authUrl}auth/google_credential`, data, { preventAuth: true })
            .then(e => {
                window.localStorage.setItem("refresh_token", e.data.refresh_token);
                window.localStorage.setItem("id_token", e.data.id_token);
                window.sessionStorage.setItem("access_token", e.data.access_token);

                let id = e.data.id_token.split(".")[1]
                let decoded = JSON.parse(atob(id))
                decoded.roles = Array.isArray(decoded.roles) ? decoded.roles : [decoded.roles]

                setUserInfo({
                    ...decoded,
                    isAuthenticated: true
                })

                onLogin(e.data, decoded)
            })
            .catch(err => {
                console.error("Login failed:", err);
            })
            .finally(() => {
                setIsLoggingIn(false);
            });
    }

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

                    <GoogleLogin onSuccess={onGoogleSuccess} />

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
