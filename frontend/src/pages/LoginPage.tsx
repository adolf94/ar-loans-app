import React from 'react';
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
import { Sparkles } from 'lucide-react';
import { GoogleLogin, useGoogleLogin, type CredentialResponse } from '@react-oauth/google';
import useUserInfo from '../components/useUserInfo';
import api from '../services/api';
import axios from 'axios';
import Login from '../components/login/Login';
import { useNavigate } from '@tanstack/react-router';

interface LoginPageProps {
    onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const theme = useTheme();
    const navigate = useNavigate()
    
    
     return <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `radial-gradient(circle at 50% 50%, ${theme.palette.primary.light}05 0%, ${theme.palette.background.default} 100%)`,
                }}
            >
        <Login onLogin={()=>navigate({to: "/client"})} />
    </Box>
       
};

export default LoginPage;
