import React, { useEffect } from 'react';
import {
    Box,
    Button,
    Typography,
    Container,
    Paper,
    Stack,
    useTheme,
    Dialog,
    Modal
} from '@mui/material';
import Login from '../components/login/Login';
import { useNavigate } from '@tanstack/react-router';
import { jwtDecode } from 'jwt-decode';

interface LoginPageProps {
    onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ }) => {
    const theme = useTheme();
    const navigate = useNavigate()

    const handlePostLogin = (token, user) => {
        const config = window.webConfig
        if (user.role.indexOf(config.adminRole) > 0) {
            return navigate({ to: "/admin" })
        }
        if (user.role.indexOf(config.guarantorRole) > 0) {
            return navigate({ to: "/guarantor" })
        }
        return navigate({ to: "/client" })
    }

    useEffect(() => {
        const token = localStorage.getItem("id_token");
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken && token) {
            handlePostLogin(token, jwtDecode<any>(token));
        }
    }, [])


    return <Box
        sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `radial-gradient(circle at 50% 50%, ${theme.palette.primary.light}05 0%, ${theme.palette.background.default} 100%)`,
        }}
    >
        <Login onLogin={handlePostLogin} />
    </Box>

};

export default LoginPage;
