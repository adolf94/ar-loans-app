import React from 'react';
import {
    Box,
    Button,
    Typography,
    Container,
    Paper,
    Stack,
    useTheme
} from '@mui/material';
import { Sparkles } from 'lucide-react';
import { GoogleLogin, useGoogleLogin, type CredentialResponse } from '@react-oauth/google';
import axios from 'axios';
import useUserInfo from '../useUserInfo';

interface LoginProps {
    onLogin: (data: any) => void;
}



const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const theme = useTheme();
    const { userInfo, setUserInfo } = useUserInfo()

    const onGoogleSuccess = (data: CredentialResponse) => {
        console.log(window.webConfig)
        axios.post(`${window.webConfig.authUrl}auth/google_credential`, data, { preventAuth: true })
            .then(e => {
                window.localStorage.setItem("refresh_token", e.data.refresh_token);
                window.localStorage.setItem("id_token", e.data.id_token);
                window.sessionStorage.setItem("access_token", e.data.access_token);

                // setBackdropLoading(false)
                let id = atob(e.data.id_token.split(".")[1])
                setUserInfo({
                    ...JSON.parse(id),
                    isAuthenticated: true                    
                })

                return onLogin(e.data)
            })
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

                    {/* <Button
                            variant="outlined"
                            size="large"
                            fullWidth
                            startIcon={<img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: 18 }} />}
                            onClick={login}
                            sx={{
                                py: 1.5,
                                borderRadius: 3,
                                textTransform: 'none',
                                fontSize: '1rem',
                                fontWeight: 600,
                                borderColor: 'divider',
                                color: 'text.primary',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    bgcolor: 'primary.50'
                                }
                            }}
                        >
                            Sign in with Google
                        </Button> */}
                    <GoogleLogin onSuccess={onGoogleSuccess} />

                    <Stack direction="row" spacing={1} alignItems="center">
                        <Sparkles size={16} color={theme.palette.primary.main} />
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Powered by Gemini 3 Flash
                        </Typography>
                    </Stack>
                </Stack>
            </Paper>
        </Container>
    );
};

export default Login;
